import type { PlayerDto, TeamDto } from '@ubt/shared';
import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { MAX_TEAMS } from '@/shared/lib/teams';
import { Button } from '@/shared/ui/button';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/cn';
import { Select } from '@/shared/ui/select';

interface TeamsPanelProps {
  readonly players: readonly PlayerDto[];
  readonly teams: readonly TeamDto[];
  readonly pending: boolean;
  readonly error: unknown;
  readonly onGenerate: (teamCount: number) => void;
  readonly onRename: (teamId: string, name: string) => void;
  /** Moves all the players to the team, or none of them. */
  readonly onMovePlayers: (playerIds: readonly string[], teamId: string) => void;
}

/**
 * Edits a team's name in place; the change is sent when the host leaves the field or presses
 * Enter. An emptied or unchanged field is reverted without bothering the server. Remounted
 * (through its `key`) whenever the name changes elsewhere, which also resets a refused draft.
 */
const TeamNameField = ({
  team,
  number,
  disabled,
  onRename,
}: {
  team: TeamDto;
  number: number;
  disabled: boolean;
  onRename: (teamId: string, name: string) => void;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(team.name);
  const commit = () => {
    const name = draft.trim();
    if (name.length === 0 || name === team.name) setDraft(team.name);
    else onRename(team.id, name);
  };
  return (
    <Input
      aria-label={t('host.teamNameLabel', { number })}
      value={draft}
      maxLength={30}
      disabled={disabled}
      className="h-9 font-semibold"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
};

/**
 * Lobby only, right before the first song: shuffles everybody into balanced teams with
 * generated names. Can be redone until the game starts.
 */
export const TeamsPanel = ({
  players,
  teams,
  pending,
  error,
  onGenerate,
  onRename,
  onMovePlayers,
}: TeamsPanelProps) => {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(2);
  // Every team needs a player: never offer more teams than players.
  const maxTeams = Math.max(2, Math.min(MAX_TEAMS, players.length));
  const teamCount = Math.min(requested, maxTeams);
  const notEnoughPlayers = players.length < 2;

  // Players ticked by the host, and the ones being dragged right now (a ref-like state: the drop
  // reads it, because `dataTransfer` is not readable before the drop in every browser).
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dragged, setDragged] = useState<readonly string[]>([]);
  const [overTeamId, setOverTeamId] = useState<string | null>(null);

  const toggle = (playerId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(playerId)) next.add(playerId);
      return next;
    });

  /** Dragging a ticked player carries the whole selection; any other player goes alone. */
  const startDrag = (event: DragEvent, playerId: string) => {
    const ids = selected.has(playerId) ? [...selected] : [playerId];
    setDragged(ids);
    // Not every environment provides one (tests, old browsers).
    const transfer = event.dataTransfer as DataTransfer | undefined;
    transfer?.setData('text/plain', ids.join(',')); // Firefox needs data to start a drag
    if (transfer) transfer.effectAllowed = 'move';
  };

  const moveTo = (ids: readonly string[], team: TeamDto) => {
    const leaving = ids.filter((id) => !team.players.some((player) => player.id === id));
    setSelected(new Set());
    setDragged([]);
    setOverTeamId(null);
    if (leaving.length > 0) onMovePlayers(leaving, team.id);
  };

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
      {teams.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('host.adjustTeamsHint')} {t('host.lateJoiners')}
        </p>
      )}
      <ErrorMessage error={error} />

      {teams.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map((team, index) => (
            <li
              key={team.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg bg-secondary p-3 transition-shadow',
                overTeamId === team.id && 'ring-2 ring-primary',
              )}
              onDragOver={(event) => {
                if (dragged.length === 0) return;
                event.preventDefault(); // makes the card a valid drop target
                setOverTeamId(team.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOverTeamId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged.length > 0) moveTo(dragged, team);
              }}
            >
              <div className="flex items-center gap-2">
                <TeamNameField
                  key={team.name}
                  team={team}
                  number={index + 1}
                  disabled={pending}
                  onRename={onRename}
                />
                <span className="text-sm text-muted-foreground">({team.players.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {team.players.map((player) => {
                  const isSelected = selected.has(player.id);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      draggable={!pending}
                      aria-pressed={isSelected}
                      disabled={pending}
                      className={cn(
                        'cursor-grab rounded-full border-2 bg-white/70 px-3 py-1 text-sm active:cursor-grabbing',
                        isSelected ? 'border-primary bg-primary/10 font-semibold' : 'border-input',
                      )}
                      onClick={() => toggle(player.id)}
                      onDragStart={(event) => startDrag(event, player.id)}
                      onDragEnd={() => {
                        setDragged([]);
                        setOverTeamId(null);
                      }}
                    >
                      {player.name}
                    </button>
                  );
                })}
              </div>
              {selected.size > 0 && (
                <Button
                  className="h-8"
                  variant="outline"
                  disabled={pending}
                  onClick={() => moveTo([...selected], team)}
                >
                  {t('host.moveSelectedHere', { count: selected.size })}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
