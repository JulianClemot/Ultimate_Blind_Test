import { describe, expect, it } from 'vitest';

import { PlaylistId } from '../../../domain';
import { DeezerMusicCatalog } from './DeezerMusicCatalog';

const playlist = (raw: string) => {
  const result = PlaylistId.parse(raw);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const deezerTrack = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Song ${id}`,
  readable: true,
  preview: `https://cdnt-preview.dzcdn.net/${id}.mp3?hdnea=exp=1`,
  artist: { id: 1, name: `Artist ${id}` },
  ...overrides,
});

/**
 * Fake fetch: `/playlist/:id` returns the playlist info, `/playlist/:id/tracks`
 * answers with `tracks(url)`. Track page requests are recorded.
 */
const fakeDeezer = (
  tracks: (url: URL) => unknown,
  info: unknown = { id: 42, title: 'Best of 80s' },
) => {
  const pages: URL[] = [];
  const fetchFn = (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (!url.pathname.endsWith('/tracks')) return Promise.resolve(Response.json(info));
    pages.push(url);
    return Promise.resolve(Response.json(tracks(url)));
  };
  return { pages, catalog: new DeezerMusicCatalog('https://api.test', fetchFn) };
};

describe('DeezerMusicCatalog', () => {
  it('maps the playlist and its playable tracks, skipping the ones without preview', async () => {
    const { pages, catalog } = fakeDeezer(() => ({
      data: [deezerTrack(1), deezerTrack(2, { preview: '' }), deezerTrack(3, { readable: false })],
      total: 3,
    }));

    const result = await catalog.playlist(playlist('42'));

    expect(result).toEqual({
      ok: true,
      value: {
        id: '42',
        title: 'Best of 80s',
        tracks: [
          {
            id: '1',
            title: 'Song 1',
            artist: 'Artist 1',
            previewUrl: 'https://cdnt-preview.dzcdn.net/1.mp3?hdnea=exp=1',
          },
        ],
      },
    });
    expect(pages[0]?.pathname).toBe('/playlist/42/tracks');
  });

  describe('resolveShareLink', () => {
    const LINK = 'https://link.deezer.com/s/34RcmQ2R65XGi5vTkvs5u';
    const redirect = (location: string | null, status = 301) =>
      new DeezerMusicCatalog('https://api.test', ((_url: string, init?: RequestInit) => {
        expect(init?.redirect).toBe('manual');
        return Promise.resolve(
          new Response(null, { status, headers: location ? { location } : {} }),
        );
      }) as unknown as typeof fetch);

    it('reads the playlist from the redirect destination', async () => {
      const dest = encodeURIComponent('https://www.deezer.com/playlist/14242065401?host=0&utm=x');
      const result = await redirect(
        `https://link.deezer.com/?awf=${dest}&dest=${dest}`,
      ).resolveShareLink(LINK);
      expect(result.ok && result.value.value).toBe('14242065401');
    });

    it('accepts a redirect straight to the playlist page', async () => {
      const result = await redirect(
        'https://www.deezer.com/fr/playlist/42?host=0',
      ).resolveShareLink(LINK);
      expect(result.ok && result.value.value).toBe('42');
    });

    it.each([
      ['an album', 'https://www.deezer.com/album/302127'],
      ['no redirect', null],
    ])('refuses a link to %s', async (_, location) => {
      const result = await redirect(location, location ? 301 : 200).resolveShareLink(LINK);
      expect(!result.ok && result.error.code).toBe('PLAYLIST_NOT_FOUND');
    });

    it('never fetches anything but share links', async () => {
      const result = await redirect('https://www.deezer.com/playlist/42').resolveShareLink(
        'https://evil.example/s/abc',
      );
      expect(!result.ok && result.error.code).toBe('PLAYLIST_NOT_FOUND');
    });

    it('reports network failures as unavailable', async () => {
      const catalog = new DeezerMusicCatalog('https://api.test', () =>
        Promise.reject(new TypeError('fetch failed')),
      );
      const result = await catalog.resolveShareLink(LINK);
      expect(!result.ok && result.error.code).toBe('MUSIC_CATALOG_UNAVAILABLE');
    });
  });

  it('follows pagination', async () => {
    const { pages, catalog } = fakeDeezer((url) =>
      url.searchParams.get('index') === '0'
        ? { data: [deezerTrack(1), deezerTrack(2)], next: 'https://api.deezer.com/…' }
        : { data: [deezerTrack(3)] },
    );

    const result = await catalog.playlist(playlist('42'));

    expect(result.ok && result.value.tracks.map((t) => t.id)).toEqual(['1', '2', '3']);
    expect(pages.map((u) => u.searchParams.get('index'))).toEqual(['0', '2']);
  });

  it('reports unknown or private playlists', async () => {
    const { pages, catalog } = fakeDeezer(() => ({ data: [] }), {
      error: { type: 'DataException', message: 'no data', code: 800 },
    });
    const result = await catalog.playlist(playlist('1'));
    expect(!result.ok && result.error.code).toBe('PLAYLIST_NOT_FOUND');
    expect(pages).toHaveLength(0);
  });

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
    ['an HTTP error', () => Promise.resolve(new Response('oops', { status: 502 }))],
    [
      'a quota error',
      () => Promise.resolve(Response.json({ error: { code: 4, message: 'Quota' } })),
    ],
    ['an unexpected body', () => Promise.resolve(Response.json({ data: 'nope' }))],
  ])('reports the catalog as unavailable on %s', async (_, fetchFn) => {
    const catalog = new DeezerMusicCatalog('https://api.test', fetchFn);
    const result = await catalog.playlist(playlist('42'));
    expect(!result.ok && result.error.code).toBe('MUSIC_CATALOG_UNAVAILABLE');
  });
});
