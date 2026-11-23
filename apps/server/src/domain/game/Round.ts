import type { RoundPlan } from '../design/RoundPlan';
import { normalize } from '../music/answerMatching';
import { trackLabel, type Suggestion, type Track } from '../music/Track';
import type { Timestamp } from '../shared/Timestamp';
import { eliminatedAfter } from './elimination';
import { Song } from './Song';

/** A round being played: the plan copied from the design at launch, plus the songs played so far. */
export class Round {
  private readonly songs: Song[] = [];
  private suggestionList: readonly Suggestion[] | undefined;
  /** Last-standing rounds: who was in the running when the first song started. */
  private participants: readonly string[] | undefined;

  constructor(
    readonly number: number,
    readonly plan: RoundPlan,
  ) {}

  get isLastStanding(): boolean {
    return this.plan.type === 'last-standing';
  }

  get isComplete(): boolean {
    if (this.songs.length >= this.plan.rules.songCount) return true;
    if (!this.isLastStanding || !this.currentSong?.isRevealed) return false;
    return this.survivors().length <= 1;
  }

  /**
   * Last-standing rounds: the players still in the running, from the songs revealed so far
   * (derived, so a host correction of a verdict is reflected). Empty before the first song and
   * for the other rounds, where nobody is ever out.
   */
  survivors(): readonly string[] {
    return this.stagesOfElimination().at(-1)?.survivors ?? this.participants ?? [];
  }

  /** Who left after `song` (revealed songs only), best known after a correction too. */
  eliminatedAfterSong(songId: string): readonly string[] {
    return this.stagesOfElimination().find((stage) => stage.songId === songId)?.eliminated ?? [];
  }

  /** Everyone who left the round so far, in the order they left. */
  eliminated(): readonly string[] {
    return this.stagesOfElimination().flatMap((stage) => stage.eliminated);
  }

  /** Whether `playerId` may still answer: always, except once out of a last-standing round. */
  canAnswer(playerId: string): boolean {
    return !this.isLastStanding || this.survivors().includes(playerId);
  }

  /** A kicked player leaves the running too. */
  forget(playerId: string): void {
    this.participants = this.participants?.filter((id) => id !== playerId);
  }

  private stagesOfElimination(): {
    songId: string;
    survivors: readonly string[];
    eliminated: readonly string[];
  }[] {
    if (!this.isLastStanding || !this.participants) return [];
    const stages: {
      songId: string;
      survivors: readonly string[];
      eliminated: readonly string[];
    }[] = [];
    let alive = this.participants;
    for (const song of this.songs) {
      if (!song.isRevealed) break;
      if (alive.length <= 1) break;
      const out = eliminatedAfter(alive, song.answersByArrival(), this.plan.rules);
      const eliminated = alive.filter((id) => out.has(id));
      alive = alive.filter((id) => !out.has(id));
      stages.push({ songId: song.id, survivors: alive, eliminated });
    }
    return stages;
  }

  get currentSong(): Song | undefined {
    return this.songs.at(-1);
  }

  /** Easy rounds only: the tracks players can pick from, alphabetical. Empty otherwise. */
  get suggestions(): readonly Suggestion[] {
    return this.suggestionList ?? [];
  }

  findSuggestion(id: string): Suggestion | undefined {
    return this.suggestions.find((suggestion) => suggestion.id === id);
  }

  /**
   * Keeps what players can pick from, once, when the round starts. Does nothing unless the round
   * is easy. The tracks of the playlist, or, in rounds about films and series, their names.
   * Nothing tells which one is the song being played.
   */
  captureSuggestions(tracks: readonly Track[]): void {
    if (!this.plan.rules.easyMode || this.suggestionList) return;
    this.suggestionList = (
      this.plan.rules.asks('source') ? sourceSuggestions(tracks) : trackSuggestions(tracks)
    ).sort((a, b) => a.label.localeCompare(b.label));
  }

  listSongs(): readonly Song[] {
    return this.songs;
  }

  /** `playerIds` are everyone present: they are the players in the running of a last-standing round. */
  addSong(
    songId: string,
    startedAt: Timestamp,
    track: Track,
    playerIds: readonly string[] = [],
  ): Song {
    this.participants ??= [...playerIds];
    const song = new Song(
      songId,
      this.number,
      this.songs.length + 1,
      startedAt,
      track,
      this.plan.rules,
    );
    this.songs.push(song);
    return song;
  }
}

const trackSuggestions = (tracks: readonly Track[]): Suggestion[] => {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  return [...byId.values()].map(({ id, title, artist }): Suggestion => ({
    id,
    kind: 'track',
    label: trackLabel({ title, artist }),
    title,
    artist,
  }));
};

const sourceSuggestions = (tracks: readonly Track[]): Suggestion[] => {
  const byKey = new Map<string, string>();
  for (const { source } of tracks) {
    const key = source ? normalize(source.name).join(' ') : '';
    if (key && !byKey.has(key)) byKey.set(key, source?.name ?? key);
  }
  return [...byKey].map(([id, label]): Suggestion => ({
    id,
    kind: 'source',
    label,
    source: label,
  }));
};
