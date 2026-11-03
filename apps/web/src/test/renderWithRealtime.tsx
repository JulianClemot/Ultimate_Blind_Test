import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
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
  finishGame: vi.fn(),
  joinGame: vi.fn(),
  rejoinGame: vi.fn(),
  submitAnswer: vi.fn(),
  ...overrides,
});

const fakeSocket = { connected: true, on: vi.fn(), off: vi.fn() } as unknown as GameSocket;

/** Renders a component with a fake game gateway instead of a real socket. */
export const renderWithRealtime = (
  ui: ReactElement,
  gateway: GameGateway = fakeGateway(),
): RenderResult => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimeContext value={{ socket: fakeSocket, gateway, connected: true }}>
        {ui}
      </RealtimeContext>
    </QueryClientProvider>,
  );
};
