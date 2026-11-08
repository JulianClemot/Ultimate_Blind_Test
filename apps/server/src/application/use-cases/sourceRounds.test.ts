import { beforeEach, describe, expect, it } from 'vitest';

import {
  FixedClock,
  frozen,
  InMemoryGameDesignRepository,
  RecordingEventPublisher,
  roundInput,
  SequenceRandom,
  SequentialIdGenerator,
  StubGameCodeGenerator,
  StubMusicCatalog,
  StubSourceResolver,
  track,
  unwrap,
} from '../../../test/doubles';
import { InMemoryGameRepository } from '../../infrastructure/secondary/persistence/InMemoryGameRepository';
import type { RoundPlanInput } from '../ports/in';
import { PlaylistAnalyzer } from '../services/PlaylistAnalyzer';
import { AnalyzePlaylist } from './AnalyzePlaylist';
import { CreateGameDesign } from './CreateGameDesign';
import { LaunchGame } from './LaunchGame';
import { NextSong } from './NextSong';
import { UpdateGameDesign } from './UpdateGameDesign';

const tangled = { name: 'Tangled', aliases: [], medium: 'movie' as const };

describe('rounds about films and series', () => {
  let designs: InMemoryGameDesignRepository;
  let games: InMemoryGameRepository;
  let clock: FixedClock;
  let ids: SequentialIdGenerator;
  let catalog: StubMusicCatalog;
  let resolver: StubSourceResolver;
  let analyzer: PlaylistAnalyzer;

  beforeEach(() => {
    designs = new InMemoryGameDesignRepository();
    games = new InMemoryGameRepository();
    clock = new FixedClock(10_000);
    ids = new SequentialIdGenerator();
    catalog = new StubMusicCatalog({ '42': [track('t1'), track('t2'), track('t3'), track('t4')] });
    resolver = new StubSourceResolver({ t1: frozen, t2: frozen, t3: tangled });
    analyzer = new PlaylistAnalyzer(resolver, catalog);
  });

  const design = async (rounds: RoundPlanInput[]) => {
    const { design: created, editToken } = unwrap(
      await new CreateGameDesign(designs, ids, clock).execute({ name: 'Disney night' }),
    );
    unwrap(
      await new UpdateGameDesign(designs, clock, catalog).execute({
        designId: created.id,
        editToken,
        name: created.name,
        rounds,
      }),
    );
    return { designId: created.id, editToken };
  };

  const play = async (round: RoundPlanInput) => {
    const access = await design([round]);
    const { game, hostToken } = unwrap(
      await new LaunchGame(
        designs,
        games,
        ids,
        new StubGameCodeGenerator(['ABCDEF']),
        clock,
        analyzer,
      ).execute(access),
    );
    const next = () =>
      new NextSong(
        games,
        ids,
        clock,
        new RecordingEventPublisher(),
        catalog,
        new SequenceRandom([0]),
        analyzer,
      ).execute({ gameId: game.id, hostToken });
    return { game, next };
  };

  const screen = (overrides: RoundPlanInput['sourceOverrides'] = {}): RoundPlanInput => ({
    ...roundInput('42', 'screen', 1),
    sourceOverrides: overrides,
  });

  it('only plays tracks whose film or series is known', async () => {
    const { game, next } = await play(screen());
    const result = unwrap(await next());
    expect(result.kind === 'song' && result.song.track.source).toBeDefined();
    expect(['t1', 't2', 't3']).toContain(game.currentSong?.track.id);
  });

  it('refuses a playlist none of whose tracks has a film or series', async () => {
    resolver = new StubSourceResolver({});
    analyzer = new PlaylistAnalyzer(resolver, catalog);
    const { next } = await play(screen());
    expect(await next()).toMatchObject({ ok: false, error: { code: 'NO_SOURCE_TRACKS' } });
  });

  it('applies the corrections of the host: renames, and excludes with null', async () => {
    const { game, next } = await play(screen({ t1: 'Moana', t2: null, t3: null }));
    unwrap(await next());
    expect(game.currentSong?.track).toMatchObject({
      id: 't1',
      source: { name: 'Moana', medium: 'movie' },
    });
  });

  it('keeps the aliases of a source the host left alone', async () => {
    const { game, next } = await play(screen({ t2: null, t3: null }));
    unwrap(await next());
    expect(game.currentSong?.track.source).toEqual(frozen);
  });

  it('proposes the names of the films and series as suggestions of an easy round', async () => {
    const easy = screen();
    const { game, next } = await play({ ...easy, rules: { ...easy.rules, easyMode: true } });
    unwrap(await next());
    expect(game.currentRound?.suggestions.map((s) => s.label)).toEqual(['Frozen', 'Tangled']);
  });

  it('does not touch the lookup for ordinary rounds', async () => {
    const { next } = await play(roundInput('42', 'classic', 1));
    unwrap(await next());
    expect(resolver.calls).toBe(0);
  });

  it('starts looking films up as soon as the game is launched', async () => {
    await play(screen());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolver.calls).toBe(1);
  });

  describe('AnalyzePlaylist', () => {
    const analyze = (access: { designId: string; editToken: string }) =>
      new AnalyzePlaylist(designs, catalog, analyzer).execute({ ...access, playlist: '42' });

    it('detects film music and names the film of each track', async () => {
      const access = await design([]);
      const analysis = unwrap(await analyze(access));
      expect(analysis).toMatchObject({ kind: 'movies', lookup: 'ai' });
      expect([...analysis.sources.keys()].sort()).toEqual(['t1', 't2', 't3']);
    });

    it('looks a playlist up once, however many times it is asked', async () => {
      const access = await design([]);
      unwrap(await analyze(access));
      unwrap(await analyze(access));
      expect(resolver.calls).toBe(1);
    });

    it('is reserved to the owner of a design', async () => {
      const access = await design([]);
      expect(await analyze({ ...access, editToken: 'wrong' })).toMatchObject({
        ok: false,
        error: { code: 'NOT_DESIGN_OWNER' },
      });
      expect(resolver.calls).toBe(0);
    });

    it('calls a playlist of ordinary songs music', async () => {
      resolver = new StubSourceResolver({ t1: frozen });
      analyzer = new PlaylistAnalyzer(resolver, catalog);
      const analysis = unwrap(await analyze(await design([])));
      expect(analysis.kind).toBe('music');
    });
  });
});
