import { beforeEach, describe, expect, it } from 'vitest';

import {
  FixedClock,
  InMemoryGameDesignRepository,
  SequentialIdGenerator,
  roundInput,
  StubMusicCatalog,
  track,
  unwrap,
} from '../../../test/doubles';
import { MAX_ROUND_NAME_LENGTH, ROUND_PRESETS } from '../../domain';
import { CheckPlaylist } from './CheckPlaylist';
import { CreateGameDesign } from './CreateGameDesign';
import { DeleteGameDesign } from './DeleteGameDesign';
import { GetGameDesign } from './GetGameDesign';
import { UpdateGameDesign } from './UpdateGameDesign';

const SHARE_LINK = 'https://link.deezer.com/s/abc123';

describe('game design use cases', () => {
  let designs: InMemoryGameDesignRepository;
  let clock: FixedClock;
  let ids: SequentialIdGenerator;
  let catalog: StubMusicCatalog;

  const create = (name = 'Friday night') =>
    new CreateGameDesign(designs, ids, clock).execute({ name });
  const update = (designId: string, editToken: string, rounds = [roundInput('42')]) =>
    new UpdateGameDesign(designs, clock, catalog).execute({
      designId,
      editToken,
      name: 'Party',
      rounds,
    });

  beforeEach(() => {
    designs = new InMemoryGameDesignRepository();
    clock = new FixedClock(10_000);
    ids = new SequentialIdGenerator();
    catalog = new StubMusicCatalog({ '42': [track('a'), track('b')] }, { [SHARE_LINK]: '42' });
  });

  it('creates an empty design with an edit token', async () => {
    const { design, editToken } = unwrap(await create());
    const stored = unwrap(
      await new GetGameDesign(designs).execute({ designId: design.id, editToken }),
    );
    expect(stored).toMatchObject({ name: 'Friday night', rounds: [] });
  });

  it('rejects invalid names', async () => {
    const result = await create('  ');
    expect(!result.ok && result.error.code).toBe('INVALID_DESIGN_NAME');
  });

  it('only lets the token holder read, edit or delete a design', async () => {
    const { design } = unwrap(await create());
    const access = { designId: design.id, editToken: 'guess' };
    for (const result of [
      await new GetGameDesign(designs).execute(access),
      await update(design.id, 'guess'),
      await new DeleteGameDesign(designs).execute(access),
    ]) {
      expect(!result.ok && result.error.code).toBe('NOT_DESIGN_OWNER');
    }
    const missing = await new GetGameDesign(designs).execute({ designId: 'nope', editToken: 'x' });
    expect(!missing.ok && missing.error.code).toBe('DESIGN_NOT_FOUND');
  });

  it('saves rounds with adjusted rules and accepts playlist URLs', async () => {
    const { design, editToken } = unwrap(await create());
    clock.advance(500);
    const tweaked = {
      ...roundInput('https://www.deezer.com/fr/playlist/7', 'flash'),
      playlistTitle: ' 80s ',
    };
    const saved = unwrap(
      await update(design.id, editToken, [
        roundInput('42'),
        { ...tweaked, rules: { ...tweaked.rules, excerptSec: 2 } },
      ]),
    );
    expect(saved.updatedAt).toBe(10_500);
    const stored = unwrap(
      await new GetGameDesign(designs).execute({ designId: design.id, editToken }),
    );
    expect(
      stored.rounds.map((r) => [r.type, r.playlist.value, r.playlistTitle, r.rules.excerptSec]),
    ).toEqual([
      ['classic', '42', null, ROUND_PRESETS.classic.excerptSec],
      ['flash', '7', '80s', 2],
    ]);
  });

  it('saves round names trimmed, and refuses overlong ones', async () => {
    const { design, editToken } = unwrap(await create());
    unwrap(
      await update(design.id, editToken, [
        { ...roundInput('42'), name: '  Warm   up  ' },
        roundInput('7'),
      ]),
    );
    const stored = unwrap(
      await new GetGameDesign(designs).execute({ designId: design.id, editToken }),
    );
    expect(stored.rounds.map((r) => r.name)).toEqual(['Warm up', '']);

    const tooLong = await update(design.id, editToken, [
      roundInput('42'),
      { ...roundInput('7'), name: 'x'.repeat(MAX_ROUND_NAME_LENGTH + 1) },
    ]);
    expect(tooLong).toMatchObject({ ok: false, error: { code: 'INVALID_ROUND_NAME' } });
    expect(!tooLong.ok && tooLong.error.message).toMatch(/^Round 2:/);
  });

  it('saves a share link as the playlist it points to', async () => {
    const { design, editToken } = unwrap(await create());
    const saved = unwrap(await update(design.id, editToken, [roundInput(SHARE_LINK)]));
    expect(saved.rounds[0]?.playlist.value).toBe('42');
    expect(catalog.shareLinkRequests).toEqual([SHARE_LINK]);
  });

  it('reports a share link that cannot be followed, with the round number', async () => {
    const { design, editToken } = unwrap(await create());
    const result = await update(design.id, editToken, [
      roundInput('42'),
      roundInput('https://link.deezer.com/s/unknown'),
    ]);
    expect(result).toMatchObject({ ok: false, error: { code: 'PLAYLIST_NOT_FOUND' } });
    expect(!result.ok && result.error.message).toMatch(/^Round 2:/);
  });

  it('names the faulty round in validation errors', async () => {
    const { design, editToken } = unwrap(await create());
    const badPlaylist = await update(design.id, editToken, [roundInput('42'), roundInput('nope')]);
    expect(badPlaylist).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYLIST' } });
    expect(!badPlaylist.ok && badPlaylist.error.message).toMatch(/^Round 2:/);

    const badRules = await update(design.id, editToken, [roundInput('42', 'classic', 0)]);
    expect(badRules).toMatchObject({ ok: false, error: { code: 'INVALID_ROUND_RULES' } });
  });

  it('deletes a design', async () => {
    const { design, editToken } = unwrap(await create());
    unwrap(await new DeleteGameDesign(designs).execute({ designId: design.id, editToken }));
    expect(await designs.findById(design.id)).toBeUndefined();
  });

  describe('CheckPlaylist', () => {
    it('returns the playlist and its playable tracks', async () => {
      const catalog = new StubMusicCatalog({ '42': [track('a'), track('b')] });
      const playlist = unwrap(
        await new CheckPlaylist(catalog).execute({ playlist: 'deezer.com/playlist/42' }),
      );
      expect(playlist).toMatchObject({ id: '42', title: 'Playlist 42' });
      expect(playlist.tracks).toHaveLength(2);
    });

    it('follows share links to the playlist they point to', async () => {
      const playlist = unwrap(await new CheckPlaylist(catalog).execute({ playlist: SHARE_LINK }));
      expect(playlist).toMatchObject({ id: '42', title: 'Playlist 42' });
      expect(catalog.shareLinkRequests).toEqual([SHARE_LINK]);
    });

    it('rejects malformed playlists without calling the catalog', async () => {
      const catalog = new StubMusicCatalog();
      const result = await new CheckPlaylist(catalog).execute({ playlist: 'hello' });
      expect(!result.ok && result.error.code).toBe('INVALID_PLAYLIST');
      expect(catalog.requests).toEqual([]);
    });
  });
});
