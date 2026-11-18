import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ServerToClientEvents } from '@ubt/shared';
import { act, render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { GameGateway } from '@/shared/realtime/gameGateway';
import { RealtimeContext } from '@/shared/realtime/RealtimeContext';
import type { GameSocket } from '@/shared/realtime/socketClient';

export const fakeGateway = (overrides: Partial<GameGateway> = {}): GameGateway => ({
  attachHost: vi.fn(),
  nextSong: vi.fn(),
  revealSong: vi.fn(),
  judgeAnswer: vi.fn(),
  generateTeams: vi.fn(),
  renameTeam: vi.fn(),
  movePlayers: vi.fn(),
  kickPlayer: vi.fn(),
  finishGame: vi.fn(),
  closeGame: vi.fn(),
  joinGame: vi.fn(),
  rejoinGame: vi.fn(),
  submitAnswer: vi.fn(),
  ...overrides,
});

type Listener = (...args: never[]) => void;

/** A socket that only remembers its listeners, so tests can push server events with `emit`. */
const createFakeSocket = () => {
  const listeners = new Map<string, Set<Listener>>();
  const socket = {
    connected: true,
    on: (event: string, listener: Listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
    },
    off: (event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    },
  };
  const emit = <E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) => {
    act(() => {
      for (const listener of listeners.get(event) ?? []) {
        (listener as (...a: unknown[]) => void)(...args);
      }
    });
  };
  return { socket: socket as unknown as GameSocket, emit };
};

/** Renders a component with a fake game gateway instead of a real socket. */
export const renderWithRealtime = (
  ui: ReactElement,
  gateway: GameGateway = fakeGateway(),
): RenderResult & { emit: ReturnType<typeof createFakeSocket>['emit'] } => {
  const { socket: fakeSocket, emit } = createFakeSocket();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeContext value={{ socket: fakeSocket, gateway, connected: true }}>
        {ui}
      </RealtimeContext>
    </QueryClientProvider>,
  );
  return { ...rendered, emit };
};
