import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PlayerSession } from './sessionStore';

export interface RecentGame extends PlayerSession {
  readonly gameName: string;
  readonly code: string;
  /** Epoch ms of the last time this browser joined or rejoined the game. */
  readonly savedAt: number;
}

/** A party lasts an evening: older entries are stale and dropped. */
export const RECENT_GAME_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT_GAMES = 3;

interface RecentGamesState {
  readonly games: readonly RecentGame[];
  readonly remember: (game: Omit<RecentGame, 'savedAt'>, now?: number) => void;
  readonly forget: (gameId: string) => void;
}

export const isFresh = (game: RecentGame, now = Date.now()) =>
  now - game.savedAt < RECENT_GAME_TTL_MS;

/**
 * The parties this browser took part in as a player, kept in localStorage (unlike the per-tab
 * session) so a closed tab, a misclicked back button or a lost connection can be undone from the
 * home page. Most recent first. Server-side the player id is the only credential, as in `rejoin`.
 */
export const useRecentGamesStore = create<RecentGamesState>()(
  persist(
    (set) => ({
      games: [],
      remember: (game, now = Date.now()) =>
        set((state) => ({
          games: [
            { ...game, savedAt: now },
            ...state.games.filter((g) => g.gameId !== game.gameId && isFresh(g, now)),
          ].slice(0, MAX_RECENT_GAMES),
        })),
      forget: (gameId) =>
        set((state) => ({ games: state.games.filter((g) => g.gameId !== gameId) })),
    }),
    { name: 'ubt-recent-games', storage: createJSONStorage(() => localStorage) },
  ),
);
