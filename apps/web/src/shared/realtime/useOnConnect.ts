import { useEffect, useRef } from 'react';

import { useRealtime } from './RealtimeContext';

/**
 * Runs `callback` now if connected, and again after every reconnection.
 * Used to (re)attach a host or player session to the server.
 */
export const useOnConnect = (callback: () => void): void => {
  const { socket } = useRealtime();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const run = () => callbackRef.current();
    socket.on('connect', run);
    if (socket.connected) run();
    return () => {
      socket.off('connect', run);
    };
  }, [socket]);
};
