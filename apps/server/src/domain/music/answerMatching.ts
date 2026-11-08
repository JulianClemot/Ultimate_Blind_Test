import type { Track } from './Track';

/** Which parts of the song an answer got right. */
export interface Verdict {
  readonly title: boolean;
  readonly artist: boolean;
}

const IGNORED_TOKENS = new Set(['the', 'a', 'an', 'le', 'la', 'les', 'l']);

/** Lowercase, no accents or punctuation, "&" read as "and". */
export const normalize = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

const withoutArticles = (tokens: readonly string[]) =>
  tokens.filter((token) => !IGNORED_TOKENS.has(token));

/** Below this many letters, dropping articles changes the name too much ("a-ha" → "ha"). */
const MIN_LETTERS_WITHOUT_ARTICLES = 4;

/** "Song (Remastered 2011) - Live feat. X" → "Song". Falls back to the raw title. */
const cleanTitle = (title: string): string => {
  const cleaned = title
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+(feat|ft)\.?\s.*$/i, '')
    .trim();
  return cleaned.length > 0 ? cleaned : title;
};

/** "A feat. B", "A, B", "A x B", "A with B": any listed artist is accepted. */
const artistNames = (artist: string): string[] => [
  artist,
  ...artist.split(/\s*(?:,|\bfeat\.?|\bft\.?|\bfeaturing\b|\swith\s|\sx\s)\s*/i),
];

const levenshtein = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
};

/** Typos allowed for a target of this length: none up to 5 letters, then about 1 every 5 letters. */
const allowedTypos = (length: number): number => (length <= 5 ? 0 : Math.floor(length / 5));

/** Whether the target words appear, in order and with a few typos at most, inside the answer. */
const containsExactly = (answer: readonly string[], target: readonly string[]): boolean => {
  if (target.length === 0) return false;
  const wanted = target.join(' ');
  const typos = allowedTypos(wanted.replace(/ /g, '').length);
  for (let size = Math.max(1, target.length - 1); size <= target.length + 1; size++) {
    for (let start = 0; start + size <= answer.length; start++) {
      const window = answer.slice(start, start + size).join(' ');
      if (window === wanted) return true;
      if (typos > 0 && levenshtein(window, wanted) <= typos) return true;
    }
  }
  return false;
};

/**
 * Checks a free-text answer ("Daft Punk - Harder Better Faster Stronger") against a track.
 * Tolerant to case, accents, punctuation, word order between title and artist, version
 * suffixes and small typos. The host can still overrule the verdict.
 */
/** Matches with articles, and without them on both sides when the target stays long enough. */
const contains = (answer: readonly string[], target: readonly string[]): boolean => {
  if (containsExactly(answer, target)) return true;
  const shortTarget = withoutArticles(target);
  return (
    shortTarget.length < target.length &&
    shortTarget.join('').length >= MIN_LETTERS_WITHOUT_ARTICLES &&
    containsExactly(withoutArticles(answer), shortTarget)
  );
};

export const matchAnswer = (text: string, track: Track): Verdict => {
  const answer = normalize(text);
  const titles = [track.title, cleanTitle(track.title)];
  return {
    title: titles.some((title) => contains(answer, normalize(title))),
    artist: artistNames(track.artist).some((name) => contains(answer, normalize(name))),
  };
};

const same = (a: string, b: string): boolean => normalize(a).join(' ') === normalize(b).join(' ');

/**
 * Verdict of a track picked from a list of suggestions. Picking is an exact choice, so, unlike
 * free text, there is no typo tolerance: "Hello" must not match "Hella".
 */
export const matchPick = (
  picked: Pick<Track, 'title' | 'artist'>,
  track: Pick<Track, 'title' | 'artist'>,
): Verdict => ({
  title: same(picked.title, track.title),
  artist: same(picked.artist, track.artist),
});
