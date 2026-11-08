import { describe, expect, it } from 'vitest';

import { findSuggestions, MAX_SUGGESTIONS } from './suggestions';

const list = [
  { id: '1', label: 'Daft Punk – One More Time' },
  { id: '2', label: 'Daft Punk – Harder, Better, Faster, Stronger' },
  { id: '3', label: 'Édith Piaf – La Vie en rose' },
  { id: '4', label: "Guns N' Roses – Don't Cry" },
];

const ids = (query: string, source = list) => findSuggestions(source, query).map((s) => s.id);

describe('findSuggestions', () => {
  it('waits for two letters', () => {
    expect(ids('d')).toEqual([]);
    expect(ids('da')).toEqual(['1', '2']);
  });

  it('matches the start of words of the artist or the title, in any order', () => {
    expect(ids('one more')).toEqual(['1']);
    expect(ids('time daft')).toEqual(['1']);
    expect(ids('harder fast')).toEqual(['2']);
  });

  it('ignores case, accents and punctuation', () => {
    expect(ids('EDITH')).toEqual(['3']);
    expect(ids('vie en ROSE')).toEqual(['3']);
    expect(ids('dont cry')).toEqual(['4']);
    expect(ids('guns n roses')).toEqual(['4']);
  });

  it('does not match inside a word', () => {
    expect(ids('unk')).toEqual([]);
  });

  it('lists a handful of suggestions at most', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      label: `Artist – Song ${i}`,
    }));
    expect(ids('artist', many)).toHaveLength(MAX_SUGGESTIONS);
  });
});
