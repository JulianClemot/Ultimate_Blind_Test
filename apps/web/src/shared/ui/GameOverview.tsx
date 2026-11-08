import type { RoundSummaryDto } from '@ubt/shared';
import { useTranslation } from 'react-i18next';

import { describeRules } from '@/shared/lib/describeRules';
import { roundTypeInfo } from '@/shared/lib/roundTypes';

/** Every round of the game with its type and rules, shown before the host starts. */
export const GameOverview = ({ rounds }: { rounds: readonly RoundSummaryDto[] }) => {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-col gap-4" aria-label={t('player.roundsOfTheGame')}>
      {rounds.map((round) => {
        const { label } = roundTypeInfo(round.type);
        return (
          <li key={round.number} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              {t('common.roundOf', { number: round.number, count: rounds.length })} · {label}
            </p>
            <h3 className="text-lg font-semibold">{round.name || label}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {describeRules(round.rules).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
};
