import type { PlayerDto } from '@ubt/shared';

export const PlayerList = ({ players }: { players: readonly PlayerDto[] }) =>
  players.length === 0 ? (
    <p className="text-sm text-muted-foreground">Waiting for players to join…</p>
  ) : (
    <ul className="flex flex-wrap gap-2">
      {players.map((player) => (
        <li key={player.id} className="rounded-full bg-secondary px-3 py-1 text-sm">
          {player.name}
        </li>
      ))}
    </ul>
  );
