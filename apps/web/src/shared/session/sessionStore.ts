import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface HostSession {
  readonly gameId: string;
  readonly hostToken: string;
}

export interface PlayerSession {
  readonly gameId: string;
  readonly playerId: string;
  readonly playerName: string;
}

interface SessionState {
  readonly host: HostSession | null;
  readonly player: PlayerSession | null;
  readonly setHost: (session: HostSession) => void;
  readonly setPlayer: (session: PlayerSession) => void;
  readonly clear: () => void;
}

/** Persisted per browser tab so a refresh or reconnection resumes the game. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      host: null,
      player: null,
      setHost: (host) => set({ host }),
      setPlayer: (player) => set({ player }),
      clear: () => set({ host: null, player: null }),
    }),
    { name: 'ubt-session', storage: createJSONStorage(() => sessionStorage) },
  ),
);
