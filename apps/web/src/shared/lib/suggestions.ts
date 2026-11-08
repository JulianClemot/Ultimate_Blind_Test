import type { SuggestionDto } from '@ubt/shared';

/** Fewest letters typed before suggestions appear. */
export const MIN_QUERY_LENGTH = 2;
/** Suggestions listed at once: enough to choose from, few enough to fit above a phone keyboard. */
export const MAX_SUGGESTIONS = 6;

const words = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Suggestions matching what the player typed: every typed word must start a word of
 * "Artist – Title" (accents, case and punctuation ignored), in any order.
 */
export const findSuggestions = (
  suggestions: readonly SuggestionDto[],
  query: string,
): SuggestionDto[] => {
  const typed = words(query);
  if (typed.join('').length < MIN_QUERY_LENGTH) return [];
  const matches: SuggestionDto[] = [];
  for (const suggestion of suggestions) {
    const known = words(suggestion.label);
    if (typed.every((word) => known.some((candidate) => candidate.startsWith(word)))) {
      matches.push(suggestion);
      if (matches.length === MAX_SUGGESTIONS) break;
    }
  }
  return matches;
};
