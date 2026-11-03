import { createContext, useContext } from 'react';

import type { GameGateway } from './gameGateway';
import type { GameSocket } from './socketClient';

export interface RealtimeContextValue {
  readonly socket: GameSocket;
  readonly gateway: GameGateway;
  readonly connected: boolean;
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const useRealtime = (): RealtimeContextValue => {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return value;
};
