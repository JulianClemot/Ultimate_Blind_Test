import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useGameStatuses } from '@/shared/api/gamesApi';
import { HttpError } from '@/shared/api/httpClient';
import { isFresh, useRecentGamesStore } from '@/shared/session/recentGamesStore';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/buttonVariants';

/** The server says the party is gone, or that this player was never in it: nothing to resume. */
const isGone = (error: unknown) =>
  error instanceof HttpError &&
  (error.code === 'GAME_NOT_FOUND' || error.code === 'UNKNOWN_PLAYER');

/**
 * Parties this browser joined recently: a way back after a misclick or a lost connection. Each is
 * checked with the server, so a finished party says so and a vanished one drops out of the list.
 */
export const ResumeGames = () => {
  const { t } = useTranslation();
  const games = useRecentGamesStore((s) => s.games);
  const forget = useRecentGamesStore((s) => s.forget);
  const fresh = games.filter((game) => isFresh(game));
  const statuses = useGameStatuses(fresh);

  const goneIds = fresh.filter((_, i) => isGone(statuses[i]?.error)).map((game) => game.gameId);
  useEffect(() => {
    goneIds.forEach(forget);
  }, [goneIds.join(), forget]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed by the ids

  const visible = fresh.filter((game) => !goneIds.includes(game.gameId));
  if (visible.length === 0) return null;

  return (
    <section aria-label={t('home.resumeTitle')} className="mb-4 flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t('home.resumeTitle')}</h3>
      <ul className="flex flex-col divide-y rounded-lg border">
        {visible.map((game) => {
          // A failed check (offline…) says nothing: the game is offered as before.
          const finished = statuses[fresh.indexOf(game)]?.data?.status === 'finished';
          return (
            <li key={game.gameId} className="flex items-center justify-between gap-2 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{game.gameName}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {t('home.resumeAs', { name: game.playerName, code: game.code })}
                  {finished && (
                    <>
                      {' · '}
                      <strong className="text-foreground">{t('home.finished')}</strong>
                    </>
                  )}
                </span>
              </span>
              <Link
                to={`/play/${game.gameId}`}
                className={buttonVariants({ variant: finished ? 'outline' : 'default' })}
              >
                {finished ? t('home.seeResults') : t('home.rejoin')}
              </Link>
              <Button
                variant="ghost"
                aria-label={t('home.forgetGame', { name: game.gameName })}
                onClick={() => forget(game.gameId)}
              >
                ✕
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
