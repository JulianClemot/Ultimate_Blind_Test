import type { RoundRules } from '../design/RoundRules';
import type { Answer } from './Answer';

const TARGETS = ['title', 'artist'] as const;
type Target = (typeof TARGETS)[number];

const speedPoints = (rules: RoundRules, elapsedMs: number): number =>
  Math.round(rules.speedBonus * Math.max(0, 1 - elapsedMs / rules.answerTimeMs));

/**
 * Points earned by each player on one song. Pure and recomputed from the answers,
 * so a host correction is reflected immediately.
 *
 * - `first`: the earliest correct players for a part (title / artist) take its points, up to
 *   `winnerCount` players (1 = the fastest only). Each place pays `rankStep` points less than
 *   the previous one.
 * - `everyone`: each player's earliest correct answer for a part scores.
 * Speed bonus applies per part found; the both-bonus goes to players credited with both parts.
 * Neither bonus depends on the place. Assisted answers (picked from an easy round's
 * suggestions) earn the points of the parts they get right, but neither bonus.
 */
export const scoreSong = (
  rules: RoundRules,
  answers: readonly Answer[],
): ReadonlyMap<string, number> => {
  const ordered = [...answers].sort((a, b) => a.receivedAt - b.receivedAt);
  const targets = TARGETS.filter((target) => rules.asks(target));
  const points = new Map<string, number>();
  const credited = new Map<string, Set<Target>>();

  const credit = (answer: Answer, target: Target, rank: number) => {
    const speed = answer.assisted ? 0 : speedPoints(rules, answer.elapsedMs);
    const gained = rules.pointsForRank(target, rank) + speed;
    points.set(answer.playerId, (points.get(answer.playerId) ?? 0) + gained);
    const parts = credited.get(answer.playerId) ?? new Set<Target>();
    parts.add(target);
    credited.set(answer.playerId, parts);
  };

  for (const target of targets) {
    const scorers = new Set<string>();
    for (const answer of ordered) {
      if (!answer.verdict[target] || scorers.has(answer.playerId)) continue;
      credit(answer, target, rules.scoring === 'first' ? scorers.size : 0);
      scorers.add(answer.playerId);
      if (rules.scoring === 'first' && scorers.size >= rules.winnerCount) break;
    }
  }

  if (targets.length === 2 && rules.bothBonus > 0) {
    const assisted = new Set(answers.filter((a) => a.assisted).map((a) => a.playerId));
    for (const [playerId, parts] of credited) {
      if (parts.size === 2 && !assisted.has(playerId))
        points.set(playerId, (points.get(playerId) ?? 0) + rules.bothBonus);
    }
  }
  return points;
};
