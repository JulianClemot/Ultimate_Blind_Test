import i18n from 'i18next';

/** A number with a fixed count of decimals, using the decimal separator of the language. */
export const formatDecimal = (value: number, digits: number): string =>
  value.toLocaleString(i18n.language, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Formats a duration in ms as seconds with millisecond precision, e.g. "1.234 s" (en). */
export const formatElapsed = (ms: number): string =>
  `${formatDecimal(Math.max(0, ms) / 1000, 3)} s`;

/** Whole seconds left, rounded up, e.g. 4.2 s → "5". */
export const formatCountdown = (ms: number): string => String(Math.ceil(Math.max(0, ms) / 1000));
