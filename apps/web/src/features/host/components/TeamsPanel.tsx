import type { PlayerDto, TeamDto } from '@ubt/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MAX_TEAMS } from '@/shared/lib/teams';
import { Button } from '@/shared/ui/button';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Field } from '@/shared/ui/Field';
import { Select } from '@/shared/ui/select';

interface TeamsPanelProps {
  readonly players: readonly PlayerDto[];
  readonly teams: readonly TeamDto[];
  readonly pending: boolean;
  readonly error: unknown;
  readonly onGenerate: (teamCount: number) => void;
}

/**
 * Lobby only, right before the first song: shuffles everybody into balanced teams with
 * generated names. Can be redone until the game starts.
 */
export const TeamsPanel = ({ players, teams, pending, error, onGenerate }: TeamsPanelProps) => {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(2);
  // Every team needs a player: never offer more teams than players.
  const maxTeams = Math.max(2, Math.min(MAX_TEAMS, players.length));
  const teamCount = Math.min(requested, maxTeams);
  const notEnoughPlayers = players.length < 2;

  return (
    <section aria-label={t('host.teams')} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('host.numberOfTeams')}>
          <Select
            value={teamCount}
            disabled={pending}
            onChange={(e) => setRequested(Number(e.target.value))}
          >
            {Array.from({ length: maxTeams - 1 }, (_, i) => i + 2).map((count) => (
              <option key={count} value={count}>
                {t('host.teamsOption', { count })}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant={teams.length > 0 ? 'outline' : 'default'}
          disabled={pending || notEnoughPlayers}
          onClick={() => onGenerate(teamCount)}
        >
          {teams.length > 0 ? t('host.shuffleTeams') : t('host.generateTeams')}
        </Button>
      </div>
      {notEnoughPlayers && <p className="text-sm text-muted-foreground">{t('host.needPlayers')}</p>}
      {teams.length > 0 && <p className="text-xs text-muted-foreground">{t('host.lateJoiners')}</p>}
      <ErrorMessage error={error} />

      {teams.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id} className="rounded-lg bg-secondary p-3">
              <p className="font-semibold">
                {team.name}{' '}
                <span className="font-normal text-muted-foreground">({team.players.length})</span>
              </p>
              <p className="text-sm">{team.players.map((player) => player.name).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
