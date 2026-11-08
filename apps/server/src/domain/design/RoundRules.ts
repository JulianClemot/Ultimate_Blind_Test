import { gameError, type GameError } from '../game/GameErrors';
import { err, ok, type Result } from '../shared/Result';

export const ROUND_TYPES = [
  'classic',
  'everyone',
  'flash',
  'fast-forward',
  'screen',
  'game',
] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

export const SCORINGS = ['first', 'everyone'] as const;
/** `first`: only the fastest correct player scores; `everyone`: every correct player scores. */
export type Scoring = (typeof SCORINGS)[number];

/** A part of a song players can be asked to find. */
export type Target = 'title' | 'artist' | 'source';

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export interface RoundRulesProps {
  readonly scoring: Scoring;
  /**
   * With `first` scoring, how many players take the points of each part: the first
   * `winnerCount` correct players. 1 means the fastest only. Ignored by `everyone`.
   */
  readonly winnerCount: number;
  /**
   * With `first` scoring: points lost by each place, so the 2nd winner gets `rankStep`
   * points less than the 1st, the 3rd twice as much less… (never below 0). 0 = same for all.
   */
  readonly rankStep: number;
  readonly songCount: number;
  /** Points for finding the title (0 = title not asked). */
  readonly titlePoints: number;
  /** Points for finding the artist (0 = artist not asked). */
  readonly artistPoints: number;
  /**
   * Points for finding the film or series the song comes from (0 = not asked). Asked instead of
   * the title and the artist: when above 0, those two must be 0.
   */
  readonly sourcePoints: number;
  /** Extra points for a player credited with both title and artist. */
  readonly bothBonus: number;
  /** Extra points for an instant answer, decreasing linearly to 0 at the end of the answer time. */
  readonly speedBonus: number;
  readonly answerTimeSec: number;
  /** Seconds of the 30 s preview that are played. */
  readonly excerptSec: number;
  readonly playbackRate: number;
  /**
   * Whether the points of this round also count for the players' teams. Individual scores
   * always count; team scores only add up the points of team-mode rounds.
   */
  readonly teamMode: boolean;
  /**
   * Players get auto-completion from the tracks of the round's playlist. An answer picked from
   * the suggestions earns the points of what it gets right, but no speed or both-parts bonus.
   */
  readonly easyMode: boolean;
}

type NumericRule = Exclude<
  keyof RoundRulesProps,
  'scoring' | 'playbackRate' | 'teamMode' | 'easyMode'
>;

export const RULE_LIMITS: Readonly<Record<NumericRule, { min: number; max: number }>> = {
  winnerCount: { min: 1, max: 50 },
  rankStep: { min: 0, max: 100 },
  songCount: { min: 1, max: 50 },
  titlePoints: { min: 0, max: 100 },
  artistPoints: { min: 0, max: 100 },
  sourcePoints: { min: 0, max: 100 },
  bothBonus: { min: 0, max: 100 },
  speedBonus: { min: 0, max: 100 },
  answerTimeSec: { min: 5, max: 120 },
  excerptSec: { min: 1, max: 30 },
};

export const ROUND_PRESETS: Readonly<Record<RoundType, RoundRulesProps>> = {
  classic: {
    scoring: 'first',
    winnerCount: 1,
    rankStep: 0,
    songCount: 10,
    titlePoints: 1,
    artistPoints: 1,
    sourcePoints: 0,
    bothBonus: 0,
    speedBonus: 0,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 1,
    teamMode: false,
    easyMode: false,
  },
  everyone: {
    scoring: 'everyone',
    winnerCount: 1,
    rankStep: 0,
    songCount: 10,
    titlePoints: 2,
    artistPoints: 2,
    sourcePoints: 0,
    bothBonus: 1,
    speedBonus: 3,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 1,
    teamMode: false,
    easyMode: false,
  },
  flash: {
    scoring: 'first',
    winnerCount: 1,
    rankStep: 0,
    songCount: 10,
    titlePoints: 2,
    artistPoints: 2,
    sourcePoints: 0,
    bothBonus: 1,
    speedBonus: 0,
    answerTimeSec: 20,
    excerptSec: 4,
    playbackRate: 1,
    teamMode: false,
    easyMode: false,
  },
  'fast-forward': {
    scoring: 'first',
    winnerCount: 1,
    rankStep: 0,
    songCount: 10,
    titlePoints: 2,
    artistPoints: 2,
    sourcePoints: 0,
    bothBonus: 1,
    speedBonus: 0,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 2,
    teamMode: false,
    easyMode: false,
  },
  screen: {
    scoring: 'first',
    winnerCount: 1,
    rankStep: 0,
    songCount: 10,
    titlePoints: 0,
    artistPoints: 0,
    sourcePoints: 2,
    bothBonus: 0,
    speedBonus: 0,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 1,
    teamMode: false,
    easyMode: false,
  },
  game: {
    scoring: 'first',
    winnerCount: 1,
    rankStep: 0,
    songCount: 10,
    titlePoints: 0,
    artistPoints: 0,
    sourcePoints: 2,
    bothBonus: 0,
    speedBonus: 0,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 1,
    teamMode: false,
    easyMode: false,
  },
};

const invalid = (message: string) => err(gameError('INVALID_ROUND_RULES', message));

/** How a round is played and scored. Built from a preset, then adjustable by the host. */
export class RoundRules implements RoundRulesProps {
  readonly scoring: Scoring;
  readonly winnerCount: number;
  readonly rankStep: number;
  readonly songCount: number;
  readonly titlePoints: number;
  readonly artistPoints: number;
  readonly sourcePoints: number;
  readonly bothBonus: number;
  readonly speedBonus: number;
  readonly answerTimeSec: number;
  readonly excerptSec: number;
  readonly playbackRate: number;
  readonly teamMode: boolean;
  readonly easyMode: boolean;

  private constructor(props: RoundRulesProps) {
    this.scoring = props.scoring;
    this.winnerCount = props.winnerCount;
    this.rankStep = props.rankStep;
    this.songCount = props.songCount;
    this.titlePoints = props.titlePoints;
    this.artistPoints = props.artistPoints;
    this.sourcePoints = props.sourcePoints;
    this.bothBonus = props.bothBonus;
    this.speedBonus = props.speedBonus;
    this.answerTimeSec = props.answerTimeSec;
    this.excerptSec = props.excerptSec;
    this.playbackRate = props.playbackRate;
    this.teamMode = props.teamMode;
    this.easyMode = props.easyMode;
  }

  static create(props: RoundRulesProps): Result<RoundRules, GameError> {
    // Props may come from storage or the network: check the union at runtime too.
    if (!(SCORINGS as readonly string[]).includes(props.scoring)) {
      return invalid('Scoring must be "first" or "everyone"');
    }
    for (const [rule, { min, max }] of Object.entries(RULE_LIMITS) as [
      NumericRule,
      typeof RULE_LIMITS.songCount,
    ][]) {
      const value = props[rule];
      if (!Number.isInteger(value) || value < min || value > max) {
        return invalid(`${rule} must be an integer between ${min} and ${max}`);
      }
    }
    if (!(PLAYBACK_RATES as readonly number[]).includes(props.playbackRate)) {
      return invalid(`playbackRate must be one of ${PLAYBACK_RATES.join(', ')}`);
    }
    if (typeof props.teamMode !== 'boolean') {
      return invalid('teamMode must be true or false');
    }
    if (typeof props.easyMode !== 'boolean') {
      return invalid('easyMode must be true or false');
    }
    if (props.sourcePoints > 0 && (props.titlePoints > 0 || props.artistPoints > 0)) {
      return invalid('A round asks either the film or series, or the title and the artist');
    }
    if (props.titlePoints === 0 && props.artistPoints === 0 && props.sourcePoints === 0) {
      return invalid('A round must reward the title, the artist, both, or the film or series');
    }
    return ok(new RoundRules(props));
  }

  static preset(type: RoundType): RoundRules {
    const rules = RoundRules.create(ROUND_PRESETS[type]);
    if (!rules.ok) throw new Error(`Invalid preset ${type}: ${rules.error.message}`);
    return rules.value;
  }

  get answerTimeMs(): number {
    return this.answerTimeSec * 1000;
  }

  /** Whether players must find this part of the song. */
  asks(target: Target): boolean {
    return this.pointsFor(target) > 0;
  }

  /** Points of a part for the winner at `rank` (0 = first place), after the descending scale. */
  pointsForRank(target: Target, rank: number): number {
    return Math.max(0, this.pointsFor(target) - rank * this.rankStep);
  }

  pointsFor(target: Target): number {
    if (target === 'source') return this.sourcePoints;
    return target === 'title' ? this.titlePoints : this.artistPoints;
  }

  toProps(): RoundRulesProps {
    return {
      scoring: this.scoring,
      winnerCount: this.winnerCount,
      rankStep: this.rankStep,
      songCount: this.songCount,
      titlePoints: this.titlePoints,
      artistPoints: this.artistPoints,
      sourcePoints: this.sourcePoints,
      bothBonus: this.bothBonus,
      speedBonus: this.speedBonus,
      answerTimeSec: this.answerTimeSec,
      excerptSec: this.excerptSec,
      playbackRate: this.playbackRate,
      teamMode: this.teamMode,
      easyMode: this.easyMode,
    };
  }
}
