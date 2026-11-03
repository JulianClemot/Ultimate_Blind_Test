/** Formats a duration in ms as seconds with millisecond precision, e.g. "1.234 s". */
export const formatElapsed = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(3)} s`;

/** Whole seconds left, rounded up, e.g. 4.2 s → "5". */
export const formatCountdown = (ms: number): string => String(Math.ceil(Math.max(0, ms) / 1000));
