import { describe, expect, it } from 'vitest';

import { en } from './locales/en';
import { fr } from './locales/fr';

const keysOf = (tree: object, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]: [string, unknown]) =>
    typeof value === 'object' && value !== null
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

/** `{{name}}` placeholders and `<tag>` markers of a message. */
const placeholders = (message: string) => (message.match(/{{\w+}}|<\/?\w+>/g) ?? []).sort();

const flat = (tree: object, prefix = ''): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]: [string, unknown]) =>
      typeof value === 'object' && value !== null
        ? Object.entries(flat(value, `${prefix}${key}.`))
        : [[`${prefix}${key}`, String(value)]],
    ),
  );

describe('translations', () => {
  it('French defines exactly the keys of English', () => {
    expect(keysOf(fr).sort()).toEqual(keysOf(en).sort());
  });

  it('French keeps the placeholders of each English message', () => {
    const english = flat(en);
    const french = flat(fr);
    for (const [key, message] of Object.entries(english)) {
      // Singular forms may drop {{count}} in some languages; here both keep it.
      expect([key, placeholders(french[key] ?? '')]).toEqual([key, placeholders(message)]);
    }
  });
});
