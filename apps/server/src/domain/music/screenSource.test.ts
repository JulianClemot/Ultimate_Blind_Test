import { describe, expect, it } from 'vitest';

import { classifyPlaylist, extractSourceHint, withOverrides } from './screenSource';
import type { TrackSource } from './Track';

const hint = (title: string, album = '') => extractSourceHint({ title, album });

describe('extractSourceHint', () => {
  it.each([
    ['Let It Go (From "Frozen")', 'Frozen'],
    [
      'Libérée, Délivrée (De "La Reine des Neiges"/Bande Originale Française)',
      'La Reine des Neiges',
    ],
    ['Comme un homme (De "Mulan")', 'Mulan'],
    ['Aller plus loin - From “Vaiana 2”', 'Vaiana 2'],
    ['Remember Me [From "Coco"]', 'Coco'],
    ['Surface Pressure (From "Encanto")', 'Encanto'],
  ])('reads the film in the title of "%s"', (title, name) => {
    expect(hint(title)).toEqual({ name, medium: 'movie' });
  });

  it.each([
    ['Coco (Bande Originale Française du Film)', 'Coco'],
    ['La Reine des Neiges (Bande Originale Française du Film)', 'La Reine des Neiges'],
    ['Zootopia (Original Motion Picture Soundtrack / Japanese version)', 'Zootopia'],
    ['Frozen: Original Motion Picture Soundtrack', 'Frozen'],
    ['Moana (Music from the Motion Picture)', 'Moana'],
  ])('reads the film in the soundtrack album "%s"', (album, name) => {
    expect(hint('Some song', album)).toEqual({ name, medium: 'movie' });
  });

  it('reads series from television soundtracks', () => {
    expect(hint('Theme', 'Stranger Things (Original Television Soundtrack)')).toEqual({
      name: 'Stranger Things',
      medium: 'series',
    });
    expect(hint('Générique (De "Friends")', '')).toEqual({ name: 'Friends', medium: 'movie' });
  });

  it('knows nothing from compilations and ordinary albums', () => {
    expect(hint("Sous l'océan", 'La Magie De Disney')).toBeNull();
    expect(hint('Song', 'Les 100 Plus Belles Chansons Disney (5 Vol.)')).toBeNull();
    expect(hint('Song', 'Greatest Hits Soundtrack Collection (Original Soundtrack)')).toBeNull();
    expect(hint('Harder, Better, Faster, Stronger', 'Discovery')).toBeNull();
    expect(hint('One More Time (Radio Edit)', 'Discovery')).toBeNull();
  });
});

const source = (medium: TrackSource['medium']): TrackSource => ({ name: 'x', aliases: [], medium });
const sources = (movies: number, series: number, games = 0) =>
  new Map<string, TrackSource>([
    ...Array.from({ length: movies }, (_, i): [string, TrackSource] => [`m${i}`, source('movie')]),
    ...Array.from({ length: series }, (_, i): [string, TrackSource] => [`s${i}`, source('series')]),
    ...Array.from({ length: games }, (_, i): [string, TrackSource] => [`g${i}`, source('game')]),
  ]);

describe('video games', () => {
  it.each([
    [
      'The Legend of Zelda: Breath of the Wild (Original Game Soundtrack)',
      'The Legend of Zelda: Breath of the Wild',
    ],
    ['Celeste (Original Video Game Soundtrack)', 'Celeste'],
    ['Hades: Video Game Soundtrack', 'Hades'],
    ['Undertale (Bande Originale du jeu vidéo)', 'Undertale'],
  ])('reads the game in the soundtrack album "%s"', (album, name) => {
    expect(hint('Some theme', album)).toEqual({ name, medium: 'game' });
  });

  it('reads a game named in a title as a game when the album says so', () => {
    expect(
      hint('Dearly Beloved (From "Kingdom Hearts")', 'Kingdom Hearts Video Game Music'),
    ).toEqual({
      name: 'Kingdom Hearts',
      medium: 'game',
    });
  });

  it('does not take a series about games for a game', () => {
    expect(hint('Theme', 'Game of Thrones (Music from the HBO Series)')).toEqual({
      name: 'Game of Thrones',
      medium: 'series',
    });
  });
});

describe('classifyPlaylist', () => {
  it('calls a playlist of mostly film tracks "movies"', () => {
    expect(classifyPlaylist(sources(8, 0), 10)).toBe('movies');
    expect(classifyPlaylist(sources(9, 1), 10)).toBe('movies');
  });

  it('calls a playlist of mostly series tracks "series"', () => {
    expect(classifyPlaylist(sources(0, 6), 10)).toBe('series');
  });

  it('calls a playlist of mostly video game tracks "games"', () => {
    expect(classifyPlaylist(sources(0, 0, 7), 10)).toBe('games');
    expect(classifyPlaylist(sources(1, 0, 9), 10)).toBe('games');
  });

  it('calls a playlist with both "mixed"', () => {
    expect(classifyPlaylist(sources(3, 0, 3), 10)).toBe('mixed');
    expect(classifyPlaylist(sources(4, 4), 10)).toBe('mixed');
  });

  it('calls a playlist with few screen tracks plain music', () => {
    expect(classifyPlaylist(sources(3, 0), 10)).toBe('music');
    expect(classifyPlaylist(new Map(), 0)).toBe('music');
  });
});

describe('withOverrides', () => {
  const found = new Map<string, TrackSource>([
    ['a', { name: 'Frozen', aliases: ['La Reine des Neiges'], medium: 'series' }],
    ['b', { name: 'Tangled', aliases: [], medium: 'movie' }],
  ]);

  it('renames, keeping the medium, and drops the aliases of a renamed source', () => {
    const result = withOverrides(found, { a: 'Moana' });
    expect(result.get('a')).toEqual({ name: 'Moana', aliases: [], medium: 'series' });
    expect(result.get('b')).toBe(found.get('b'));
  });

  it('keeps a source whose name the host retyped unchanged', () => {
    expect(withOverrides(found, { a: ' Frozen ' }).get('a')).toBe(found.get('a'));
  });

  it('removes the tracks set to null or blank', () => {
    expect([...withOverrides(found, { a: null, b: '  ' }).keys()]).toEqual([]);
  });

  it('adds a source to a track the lookup could not place', () => {
    expect(withOverrides(found, { z: 'Cars' }).get('z')).toEqual({
      name: 'Cars',
      aliases: [],
      medium: 'movie',
    });
  });

  it('does not change what it is given', () => {
    withOverrides(found, { a: null });
    expect(found.size).toBe(2);
  });
});
