import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { createSocketGameGateway } from './gameGateway';
import { RealtimeContext } from './RealtimeContext';
import { createGameSocket } from './socketClient';

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const [socket] = useState(createGameSocket);
  const [connected, setConnected] = useState(socket.connected);
  const gateway = useMemo(() => createSocketGameGateway(socket), [socket]);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, gateway, connected }), [socket, gateway, connected]);
  return <RealtimeContext value={value}>{children}</RealtimeContext>;
};
