import { describe, expect, it } from 'vitest';

import { matchAnswer } from './answerMatching';
import type { Track } from './Track';

const track = (title: string, artist: string): Track => ({
  id: '1',
  title,
  artist,
  previewUrl: 'https://cdn.test/1.mp3',
});

const daftPunk = track('Harder, Better, Faster, Stronger', 'Daft Punk');

describe('matchAnswer', () => {
  it.each([
    ['Daft Punk - Harder Better Faster Stronger', true, true],
    ['harder better faster stronger', true, false],
    ['DAFT PUNK', false, true],
    ['Harder Beter Faster Stronger by daft punk', true, true],
    ['Get Lucky - Daft Punk', false, true],
    ['Justice', false, false],
    ['', false, false],
  ])('"%s" → title %s, artist %s', (text, title, artist) => {
    expect(matchAnswer(text, daftPunk)).toEqual({ title, artist });
  });

  it('ignores accents and articles', () => {
    expect(matchAnswer('Edith Piaf la vie en rose', track('La Vie en rose', 'Édith Piaf'))).toEqual(
      { title: true, artist: true },
    );
    expect(matchAnswer('Beatles', track('Help!', 'The Beatles')).artist).toBe(true);
  });

  it('keeps articles when dropping them would leave too little of the name', () => {
    const aha = track('Take On Me', 'a-ha');
    expect(matchAnswer('ah ha take me on', aha).artist).toBe(false);
    expect(matchAnswer('A-ha', aha).artist).toBe(true);
    expect(matchAnswer('Le Vent', track('Le Vent nous portera', 'Noir Désir')).title).toBe(false);
  });

  it('ignores version suffixes in titles', () => {
    const remaster = track('Heroes (2017 Remaster) - Live', 'David Bowie');
    expect(matchAnswer('heroes', remaster).title).toBe(true);
    expect(matchAnswer('Heroes 2017 Remaster', remaster).title).toBe(true);
  });

  it('accepts any featured artist', () => {
    const feat = track('Stay', 'The Kid LAROI, Justin Bieber');
    expect(matchAnswer('justin bieber', feat).artist).toBe(true);
    expect(matchAnswer('the kid laroi', feat).artist).toBe(true);
  });

  it('reads "&" as "and"', () => {
    expect(matchAnswer('simon and garfunkel', track('The Boxer', 'Simon & Garfunkel')).artist).toBe(
      true,
    );
  });

  it('allows no typo on short words', () => {
    const short = track('Hello', 'Adele');
    expect(matchAnswer('Adel', short).artist).toBe(false);
    expect(matchAnswer('Helo', short).title).toBe(false);
    expect(matchAnswer('Hello Adele', short)).toEqual({ title: true, artist: true });
  });

  it('allows a typo on longer words', () => {
    expect(matchAnswer('Rihana', track('Umbrella', 'Rihanna')).artist).toBe(true);
    expect(matchAnswer('Umbrela', track('Umbrella', 'Rihanna')).title).toBe(true);
  });
});
