import type { RoundSummaryDto } from '@ubt/shared';

import { describeRules } from '@/shared/lib/describeRules';
import { ROUND_TYPE_INFO } from '@/shared/lib/roundTypes';

/** Every round of the game with its type and rules, shown before the host starts. */
export const GameOverview = ({ rounds }: { rounds: readonly RoundSummaryDto[] }) => (
  <ol className="flex flex-col gap-4" aria-label="Rounds of the game">
    {rounds.map((round) => (
      <li key={round.number} className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          Round {round.number}/{rounds.length} · {ROUND_TYPE_INFO[round.type].label}
        </p>
        <h3 className="text-lg font-semibold">{round.name || ROUND_TYPE_INFO[round.type].label}</h3>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {describeRules(round.rules).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </li>
    ))}
  </ol>
);
