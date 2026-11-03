import { gameError, type GameError } from '../game/GameErrors';
import { err, ok, type Result } from '../shared/Result';

export const ROUND_TYPES = ['classic', 'everyone', 'flash', 'fast-forward'] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

export const SCORINGS = ['first', 'everyone'] as const;
/** `first`: only the fastest correct player scores; `everyone`: every correct player scores. */
export type Scoring = (typeof SCORINGS)[number];

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export interface RoundRulesProps {
  readonly scoring: Scoring;
  readonly songCount: number;
  /** Points for finding the title (0 = title not asked). */
  readonly titlePoints: number;
  /** Points for finding the artist (0 = artist not asked). */
  readonly artistPoints: number;
  /** Extra points for a player credited with both title and artist. */
  readonly bothBonus: number;
  /** Extra points for an instant answer, decreasing linearly to 0 at the end of the answer time. */
  readonly speedBonus: number;
  readonly answerTimeSec: number;
  /** Seconds of the 30 s preview that are played. */
  readonly excerptSec: number;
  readonly playbackRate: number;
}

type NumericRule = Exclude<keyof RoundRulesProps, 'scoring' | 'playbackRate'>;

export const RULE_LIMITS: Readonly<Record<NumericRule, { min: number; max: number }>> = {
  songCount: { min: 1, max: 50 },
  titlePoints: { min: 0, max: 100 },
  artistPoints: { min: 0, max: 100 },
  bothBonus: { min: 0, max: 100 },
  speedBonus: { min: 0, max: 100 },
  answerTimeSec: { min: 5, max: 120 },
  excerptSec: { min: 1, max: 30 },
};

export const ROUND_PRESETS: Readonly<Record<RoundType, RoundRulesProps>> = {
  classic: {
    scoring: 'first',
    songCount: 10,
    titlePoints: 1,
    artistPoints: 1,
    bothBonus: 0,
    speedBonus: 0,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 1,
  },
  everyone: {
    scoring: 'everyone',
    songCount: 10,
    titlePoints: 2,
    artistPoints: 2,
    bothBonus: 1,
    speedBonus: 3,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 1,
  },
  flash: {
    scoring: 'first',
    songCount: 10,
    titlePoints: 2,
    artistPoints: 2,
    bothBonus: 1,
    speedBonus: 0,
    answerTimeSec: 20,
    excerptSec: 4,
    playbackRate: 1,
  },
  'fast-forward': {
    scoring: 'first',
    songCount: 10,
    titlePoints: 2,
    artistPoints: 2,
    bothBonus: 1,
    speedBonus: 0,
    answerTimeSec: 30,
    excerptSec: 30,
    playbackRate: 2,
  },
};

const invalid = (message: string) => err(gameError('INVALID_ROUND_RULES', message));

/** How a round is played and scored. Built from a preset, then adjustable by the host. */
export class RoundRules implements RoundRulesProps {
  readonly scoring: Scoring;
  readonly songCount: number;
  readonly titlePoints: number;
  readonly artistPoints: number;
  readonly bothBonus: number;
  readonly speedBonus: number;
  readonly answerTimeSec: number;
  readonly excerptSec: number;
  readonly playbackRate: number;

  private constructor(props: RoundRulesProps) {
    this.scoring = props.scoring;
    this.songCount = props.songCount;
    this.titlePoints = props.titlePoints;
    this.artistPoints = props.artistPoints;
    this.bothBonus = props.bothBonus;
    this.speedBonus = props.speedBonus;
    this.answerTimeSec = props.answerTimeSec;
    this.excerptSec = props.excerptSec;
    this.playbackRate = props.playbackRate;
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
    if (props.titlePoints === 0 && props.artistPoints === 0) {
      return invalid('A round must reward the title, the artist or both');
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
  asks(target: 'title' | 'artist'): boolean {
    return this.pointsFor(target) > 0;
  }

  pointsFor(target: 'title' | 'artist'): number {
    return target === 'title' ? this.titlePoints : this.artistPoints;
  }

  toProps(): RoundRulesProps {
    return {
      scoring: this.scoring,
      songCount: this.songCount,
      titlePoints: this.titlePoints,
      artistPoints: this.artistPoints,
      bothBonus: this.bothBonus,
      speedBonus: this.speedBonus,
      answerTimeSec: this.answerTimeSec,
      excerptSec: this.excerptSec,
      playbackRate: this.playbackRate,
    };
  }
}
