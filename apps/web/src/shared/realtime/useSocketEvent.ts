import type { ServerToClientEvents } from '@ubt/shared';
import { useEffect, useRef } from 'react';

import { useRealtime } from './RealtimeContext';

/** Subscribes to a server event for the lifetime of the component. */
export const useSocketEvent = <E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E],
): void => {
  const { socket } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (...args: Parameters<ServerToClientEvents[E]>) => {
      (handlerRef.current as (...a: typeof args) => void)(...args);
    };
    // socket.io's typed overloads cannot be narrowed through a generic key.
    const untyped = socket as unknown as {
      on(e: string, l: typeof listener): void;
      off(e: string, l: typeof listener): void;
    };
    untyped.on(event, listener);
    return () => untyped.off(event, listener);
  }, [socket, event]);
};
