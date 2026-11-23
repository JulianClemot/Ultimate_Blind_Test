import type { RoundRules, Target } from '../design/RoundRules';
import type { Answer } from './Answer';

const TARGETS: readonly Target[] = ['title', 'artist', 'source'];

/** An answer counts as a find when the verdict credits at least one part the round asks for. */
const foundSomething = (rules: RoundRules, answer: Answer): boolean =>
  TARGETS.some((target) => rules.asks(target) && answer.verdict[target]);

/**
 * Who leaves a last-standing round after a song, among the players still in the running.
 *
 * - A player who found nothing (no answer, or only wrong ones) leaves.
 * - Among those who found it, the `eliminationCount` slowest leave (server reception time,
 *   arrival order on a tie).
 * - Somebody always stays: if that would empty the round, the fastest finder is spared; if
 *   nobody found the song, nobody leaves.
 */
export const eliminatedAfter = (
  alive: readonly string[],
  answers: readonly Answer[],
  rules: RoundRules,
): ReadonlySet<string> => {
  const inRunning = new Set(alive);
  const finders: string[] = [];
  for (const answer of [...answers].sort((a, b) => a.receivedAt - b.receivedAt)) {
    if (!inRunning.has(answer.playerId) || finders.includes(answer.playerId)) continue;
    if (foundSomething(rules, answer)) finders.push(answer.playerId);
  }

  const eliminated = new Set(alive.filter((id) => !finders.includes(id)));
  for (const id of finders.slice(Math.max(0, finders.length - rules.eliminationCount))) {
    eliminated.add(id);
  }

  if (eliminated.size >= inRunning.size) {
    const fastest = finders[0];
    if (fastest === undefined) return new Set();
    eliminated.delete(fastest);
  }
  return eliminated;
};
