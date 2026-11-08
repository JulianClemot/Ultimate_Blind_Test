import type {
  GameDesignDto,
  NumericRuleDto,
  PlaylistSummaryDto,
  RoundCatalogDto,
  RoundRulesDto,
  RoundTypeDto,
  UpdateGameDesignPayload,
} from '@ubt/shared';
import { t } from 'i18next';

/** Pure state of the design editor — easy to unit test. */

export interface EditorRound {
  /** Stable React key; not sent to the server. */
  readonly key: string;
  /** Round name as typed; empty means "use the round type". */
  readonly name: string;
  /**
   * True while the name was filled in from the playlist title (not typed by the host):
   * it then follows the playlist when it changes.
   */
  readonly nameIsAuto: boolean;
  readonly type: RoundTypeDto;
  /** Deezer playlist id or URL, as typed. */
  readonly playlist: string;
  readonly playlistTitle: string | null;
  /** Known after a successful check of the current `playlist`. */
  readonly playableTracks: number | null;
  readonly rules: RoundRulesDto;
}

export interface EditorState {
  readonly name: string;
  readonly rounds: readonly EditorRound[];
  /** Unsaved changes. */
  readonly dirty: boolean;
}

export type EditorAction =
  | { type: 'loaded'; design: GameDesignDto }
  | { type: 'renamed'; name: string }
  | { type: 'roundAdded'; key: string; roundType: RoundTypeDto; catalog: RoundCatalogDto }
  | { type: 'roundRemoved'; key: string }
  | { type: 'roundRenamed'; key: string; name: string }
  | { type: 'roundMoved'; key: string; offset: -1 | 1 }
  | { type: 'roundTypeChanged'; key: string; roundType: RoundTypeDto; catalog: RoundCatalogDto }
  | { type: 'ruleChanged'; key: string; rule: NumericRuleDto; value: number }
  | { type: 'scoringChanged'; key: string; scoring: RoundRulesDto['scoring'] }
  | { type: 'playbackRateChanged'; key: string; rate: number }
  | { type: 'teamModeChanged'; key: string; teamMode: boolean }
  | { type: 'easyModeChanged'; key: string; easyMode: boolean }
  | { type: 'playlistChanged'; key: string; playlist: string }
  | { type: 'playlistChecked'; key: string; playlist: string; summary: PlaylistSummaryDto }
  | { type: 'saved'; design: GameDesignDto };

export const emptyEditor: EditorState = { name: '', rounds: [], dirty: false };

const fromDesign = (design: GameDesignDto): EditorState => ({
  name: design.name,
  rounds: design.rounds.map((round, index) => ({
    key: `saved-${index}`,
    name: round.name,
    nameIsAuto: false,
    type: round.type,
    playlist: round.playlist,
    playlistTitle: round.playlistTitle,
    playableTracks: null,
    rules: round.rules,
  })),
  dirty: false,
});

const updateRound = (
  state: EditorState,
  key: string,
  change: (round: EditorRound) => EditorRound,
): EditorState => ({
  ...state,
  dirty: true,
  rounds: state.rounds.map((round) => (round.key === key ? change(round) : round)),
});

export const designEditorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'loaded':
      return fromDesign(action.design);
    case 'saved':
      // Keep local keys and check results: the server echoes what was sent.
      return { ...state, name: action.design.name, dirty: false };
    case 'renamed':
      return { ...state, name: action.name, dirty: true };
    case 'roundAdded':
      if (state.rounds.length >= action.catalog.maxRounds) return state;
      return {
        ...state,
        dirty: true,
        rounds: [
          ...state.rounds,
          {
            key: action.key,
            // Most hosts reuse a playlist for several rounds, so its title names the round too.
            name: state.rounds.at(-1)?.playlistTitle ?? '',
            nameIsAuto: true,
            type: action.roundType,
            playlist: state.rounds.at(-1)?.playlist ?? '',
            playlistTitle: state.rounds.at(-1)?.playlistTitle ?? null,
            playableTracks: state.rounds.at(-1)?.playableTracks ?? null,
            rules: action.catalog.presets[action.roundType],
          },
        ],
      };
    case 'roundRenamed':
      // Clearing the name hands it back to the playlist title.
      return updateRound(state, action.key, (round) => ({
        ...round,
        name: action.name,
        nameIsAuto: action.name.trim() === '',
      }));
    case 'roundRemoved':
      return { ...state, dirty: true, rounds: state.rounds.filter((r) => r.key !== action.key) };
    case 'roundMoved': {
      const from = state.rounds.findIndex((r) => r.key === action.key);
      const to = from + action.offset;
      if (from < 0 || to < 0 || to >= state.rounds.length) return state;
      const rounds = [...state.rounds];
      const [moved] = rounds.splice(from, 1);
      if (moved) rounds.splice(to, 0, moved);
      return { ...state, dirty: true, rounds };
    }
    case 'roundTypeChanged':
      // A new type resets the rules to its preset, except the number of songs, the team mode and the easy mode.
      return updateRound(state, action.key, (round) => ({
        ...round,
        type: action.roundType,
        rules: {
          ...action.catalog.presets[action.roundType],
          songCount: round.rules.songCount,
          teamMode: round.rules.teamMode,
          easyMode: round.rules.easyMode,
        },
      }));
    case 'ruleChanged':
      return updateRound(state, action.key, (round) => ({
        ...round,
        rules: { ...round.rules, [action.rule]: action.value },
      }));
    case 'scoringChanged':
      return updateRound(state, action.key, (round) => ({
        ...round,
        rules: { ...round.rules, scoring: action.scoring },
      }));
    case 'playbackRateChanged':
      return updateRound(state, action.key, (round) => ({
        ...round,
        rules: { ...round.rules, playbackRate: action.rate },
      }));
    case 'teamModeChanged':
      return updateRound(state, action.key, (round) => ({
        ...round,
        rules: { ...round.rules, teamMode: action.teamMode },
      }));
    case 'easyModeChanged':
      return updateRound(state, action.key, (round) => ({
        ...round,
        rules: { ...round.rules, easyMode: action.easyMode },
      }));
    case 'playlistChanged':
      return updateRound(state, action.key, (round) => ({
        ...round,
        playlist: action.playlist,
        playlistTitle: null,
        playableTracks: null,
        name: round.nameIsAuto ? '' : round.name,
      }));
    case 'playlistChecked':
      // Ignore a late answer for a playlist that was edited meanwhile.
      if (state.rounds.find((r) => r.key === action.key)?.playlist !== action.playlist)
        return state;
      return updateRound(state, action.key, (round) => ({
        ...round,
        // Whatever was pasted (id, URL with tracking, share link) becomes the canonical URL.
        playlist: `https://www.deezer.com/playlist/${action.summary.id}`,
        playlistTitle: action.summary.title,
        playableTracks: action.summary.playableTracks,
        // Only name rounds the host left unnamed (or named automatically before).
        ...(round.nameIsAuto || round.name.trim() === ''
          ? { name: action.summary.title, nameIsAuto: true }
          : {}),
      }));
  }
};

export const toUpdatePayload = (state: EditorState): UpdateGameDesignPayload => ({
  name: state.name,
  rounds: state.rounds.map((round) => ({
    name: round.name,
    type: round.type,
    playlist: round.playlist,
    playlistTitle: round.playlistTitle,
    rules: round.rules,
  })),
});

/** Problems the host should fix before launching (the server checks the rest). */
export const roundWarnings = (round: EditorRound): string[] => {
  const warnings: string[] = [];
  if (!round.playlist.trim()) warnings.push(t('design.warnNoPlaylist'));
  if (round.playableTracks !== null && round.playableTracks < round.rules.songCount) {
    warnings.push(
      t('design.warnFewTracks', { tracks: round.playableTracks, songs: round.rules.songCount }),
    );
  }
  const { scoring, winnerCount, rankStep, titlePoints, artistPoints } = round.rules;
  const lastPlace = (winnerCount - 1) * rankStep;
  if (scoring === 'first' && winnerCount > 1 && rankStep > 0) {
    const asked = [titlePoints, artistPoints].filter((points) => points > 0);
    if (asked.some((points) => points - lastPlace <= 0)) {
      warnings.push(t('design.warnNoPoints'));
    }
  }
  if (round.rules.titlePoints === 0 && round.rules.artistPoints === 0) {
    warnings.push(t('design.warnNoScoring'));
  }
  return warnings;
};

export const totalSongs = (state: EditorState): number =>
  state.rounds.reduce((sum, round) => sum + round.rules.songCount, 0);
