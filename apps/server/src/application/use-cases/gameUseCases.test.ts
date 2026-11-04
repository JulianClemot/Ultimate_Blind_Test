import { beforeEach, describe, expect, it } from 'vitest';

import {
  FixedClock,
  InMemoryGameDesignRepository,
  ManualScheduler,
  RecordingEventPublisher,
  roundInput,
  SequenceRandom,
  SequentialIdGenerator,
  StubGameCodeGenerator,
  StubMusicCatalog,
  track,
  unwrap,
} from '../../../test/doubles';
import { InMemoryGameRepository } from '../../infrastructure/secondary/persistence/InMemoryGameRepository';
import type { RoundPlanInput } from '../ports/in';
import { AttachHost } from './AttachHost';
import { AutoRevealSong } from './AutoRevealSong';
import { CreateGameDesign } from './CreateGameDesign';
import { FinishGame } from './FinishGame';
import { JoinGame } from './JoinGame';
import { JudgeAnswer } from './JudgeAnswer';
import { LaunchGame } from './LaunchGame';
import { NextSong } from './NextSong';
import { RejoinGame } from './RejoinGame';
import { RevealSong } from './RevealSong';
import { SubmitAnswer } from './SubmitAnswer';
import { UpdateGameDesign } from './UpdateGameDesign';

describe('party use cases', () => {
  let designs: InMemoryGameDesignRepository;
  let games: InMemoryGameRepository;
  let clock: FixedClock;
  let events: RecordingEventPublisher;
  let scheduler: ManualScheduler;
  let ids: SequentialIdGenerator;
  let codes: StubGameCodeGenerator;
  let catalog: StubMusicCatalog;
  let random: SequenceRandom;

  beforeEach(() => {
    designs = new InMemoryGameDesignRepository();
    games = new InMemoryGameRepository();
    clock = new FixedClock(10_000);
    events = new RecordingEventPublisher();
    scheduler = new ManualScheduler();
    ids = new SequentialIdGenerator();
    codes = new StubGameCodeGenerator(['ABCDEF']);
    catalog = new StubMusicCatalog({
      '42': [track('t1'), track('t2'), track('t3')],
      '7': [track('t1'), track('x1')],
    });
    random = new SequenceRandom([0]);
  });

  const designWith = async (rounds: RoundPlanInput[]) => {
    const { design, editToken } = unwrap(
      await new CreateGameDesign(designs, ids, clock).execute({ name: 'Friday night' }),
    );
    unwrap(
      await new UpdateGameDesign(designs, clock, catalog).execute({
        designId: design.id,
        editToken,
        name: design.name,
        rounds,
      }),
    );
    return { designId: design.id, editToken };
  };

  const launch = async (
    rounds = [roundInput('42', 'classic', 2), roundInput('7', 'everyone', 1)],
  ) => {
    const access = await designWith(rounds);
    const { game, hostToken } = unwrap(
      await new LaunchGame(designs, games, ids, codes, clock).execute(access),
    );
    return { game, host: { gameId: game.id, hostToken } };
  };

  const join = (playerName: string) =>
    new JoinGame(games, ids, clock, events).execute({ code: 'ABCDEF', playerName });
  const nextSong = (host: { gameId: string; hostToken: string }) =>
    new NextSong(games, ids, clock, events, catalog, random).execute(host);
  const reveal = (host: { gameId: string; hostToken: string }) =>
    new RevealSong(games, clock, events).execute(host);
  const answer = (gameId: string, playerId: string, text: string) =>
    new SubmitAnswer(
      games,
      ids,
      clock,
      events,
      scheduler,
      new AutoRevealSong(games, clock, events),
    ).execute({
      gameId,
      playerId,
      text,
      clientSentAt: 42,
    });

  describe('LaunchGame', () => {
    it('creates a game from the design rounds, in the lobby', async () => {
      const { game } = await launch();
      expect(game.status).toBe('lobby');
      expect(game.name).toBe('Friday night');
      expect(game.listRounds().map((r) => [r.plan.type, r.plan.playlist.value])).toEqual([
        ['classic', '42'],
        ['everyone', '7'],
      ]);
    });

    it('refuses an empty design', async () => {
      const access = await designWith([]);
      const result = await new LaunchGame(designs, games, ids, codes, clock).execute(access);
      expect(!result.ok && result.error.code).toBe('EMPTY_DESIGN');
    });

    it('is reserved to the design owner', async () => {
      const { designId } = await designWith([roundInput('42')]);
      const result = await new LaunchGame(designs, games, ids, codes, clock).execute({
        designId,
        editToken: 'guess',
      });
      expect(!result.ok && result.error.code).toBe('NOT_DESIGN_OWNER');
    });

    it('retries until the code is unique, then gives up', async () => {
      codes = new StubGameCodeGenerator(['ABCDEF', 'ABCDEF', 'GHJKMN']);
      await launch();
      const { game } = await launch();
      expect(game.code.value).toBe('GHJKMN');
      const access = await designWith([roundInput('42')]);
      const third = await new LaunchGame(designs, games, ids, codes, clock).execute(access);
      expect(!third.ok && third.error.code).toBe('CODE_GENERATION_FAILED');
    });
  });

  describe('AttachHost / JoinGame / RejoinGame', () => {
    it('returns the game to its host only', async () => {
      const { game, host } = await launch();
      expect(unwrap(await new AttachHost(games).execute(host))).toBe(game);
      const intruder = await new AttachHost(games).execute({ ...host, hostToken: 'nope' });
      expect(!intruder.ok && intruder.error.code).toBe('NOT_HOST');
    });

    it('adds players, notifies the host and restores sessions', async () => {
      const { game } = await launch();
      const { player } = unwrap(await join('Alice'));
      expect(events.types()).toEqual(['playerJoined']);
      const session = unwrap(
        await new RejoinGame(games).execute({ gameId: game.id, playerId: player.id }),
      );
      expect(session.player).toBe(player);
      const unknown = await new JoinGame(games, ids, clock, events).execute({
        code: 'ZZZZZZ',
        playerName: 'Bob',
      });
      expect(!unknown.ok && unknown.error.code).toBe('GAME_NOT_FOUND');
    });
  });

  describe('NextSong', () => {
    it('is reserved to the host', async () => {
      const { host } = await launch();
      const result = await nextSong({ ...host, hostToken: 'nope' });
      expect(!result.ok && result.error.code).toBe('NOT_HOST');
    });

    it('plays a random track of the round playlist at the current server time', async () => {
      random = new SequenceRandom([2]);
      const { host } = await launch();
      const result = unwrap(await nextSong(host));
      expect(result).toMatchObject({
        kind: 'song',
        song: { roundNumber: 1, number: 1, startedAt: 10_000 },
      });
      expect(result.kind === 'song' && result.song.track).toEqual(track('t3'));
      expect(catalog.requests).toEqual(['42']);
      expect(events.types()).toEqual(['songStarted']);
    });

    it('waits for the reveal before the next song, without calling the catalog', async () => {
      const { host } = await launch();
      unwrap(await nextSong(host));
      const result = await nextSong(host);
      expect(!result.ok && result.error.code).toBe('SONG_IN_PROGRESS');
      expect(catalog.requests).toHaveLength(1);
    });

    it('moves through rounds, never replays a track, then finishes the game', async () => {
      const { host } = await launch();
      const played: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = unwrap(await nextSong(host));
        if (result.kind === 'song')
          played.push(`${result.song.roundNumber}:${result.song.track.id}`);
        unwrap(await reveal(host));
      }
      // Round 2 uses playlist 7, whose t1 was already played in round 1.
      expect(played).toEqual(['1:t1', '1:t2', '2:x1']);

      const end = unwrap(await nextSong(host));
      expect(end.kind).toBe('finished');
      expect(end.game.status).toBe('finished');
      expect(events.types().at(-1)).toBe('gameFinished');
    });

    it('reports exhausted playlists and catalog failures', async () => {
      const { host } = await launch([roundInput('7', 'classic', 5)]);
      unwrap(await nextSong(host));
      unwrap(await reveal(host));
      unwrap(await nextSong(host));
      unwrap(await reveal(host));
      const exhausted = await nextSong(host);
      expect(!exhausted.ok && exhausted.error.code).toBe('PLAYLIST_EXHAUSTED');

      catalog.failure = { code: 'MUSIC_CATALOG_UNAVAILABLE', message: 'Deezer is down' };
      const down = await nextSong(host);
      expect(!down.ok && down.error.code).toBe('MUSIC_CATALOG_UNAVAILABLE');
    });
  });

  describe('answers, corrections and reveal', () => {
    it('checks answers with the server clock and notifies the host', async () => {
      const { game, host } = await launch();
      const { player } = unwrap(await join('Alice'));
      unwrap(await join('Bob'));
      unwrap(await nextSong(host));
      clock.advance(2_500);

      const { answer: sent } = unwrap(await answer(game.id, player.id, 'Artist t1 - Title t1'));

      expect(sent).toMatchObject({
        receivedAt: 12_500,
        elapsedMs: 2_500,
        clientSentAt: 42,
        verdict: { title: true, artist: true },
      });
      expect(events.events.at(-1)).toMatchObject({ type: 'answerReceived', answer: sent });
    });

    it('lets the host correct a verdict, then publishes scores once revealed', async () => {
      const { game, host } = await launch();
      const { player } = unwrap(await join('Alice'));
      unwrap(await join('Bob'));
      unwrap(await nextSong(host));
      const { answer: sent } = unwrap(await answer(game.id, player.id, 'the one with the piano'));
      expect(sent.verdict).toEqual({ title: false, artist: false });
      const judge = (title: boolean) =>
        new JudgeAnswer(games, events).execute({
          ...host,
          answerId: sent.id,
          title,
          artist: false,
        });

      const { answer: judged } = unwrap(await judge(true));
      expect(judged).toMatchObject({ verdict: { title: true, artist: false }, judgedByHost: true });
      expect(events.types().slice(-1)).toEqual(['answerJudged']);

      const { song } = unwrap(await reveal(host));
      expect(song.isRevealed).toBe(true);
      expect(events.types().at(-1)).toBe('songRevealed');
      expect(game.scoreboard({ revealedOnly: true })[0]?.points).toBe(1);

      unwrap(await judge(false));
      expect(events.types().slice(-2)).toEqual(['answerJudged', 'scoreboardUpdated']);
      expect(game.scoreboard({ revealedOnly: true })[0]?.points).toBe(0);
    });

    describe('once everyone answered', () => {
      const twoPlayersOnASong = async () => {
        const { game, host } = await launch();
        const alice = unwrap(await join('Alice')).player;
        const bob = unwrap(await join('Bob')).player;
        unwrap(await nextSong(host));
        return { game, host, alice, bob };
      };

      it('waits for the last player before announcing anything', async () => {
        const { game, alice } = await twoPlayersOnASong();
        unwrap(await answer(game.id, alice.id, 'no idea'));
        expect(events.types()).not.toContain('allAnswered');
        expect(scheduler.scheduled).toHaveLength(0);
      });

      it('announces it, then reveals the song after the pause', async () => {
        const { game, alice, bob } = await twoPlayersOnASong();
        unwrap(await answer(game.id, alice.id, 'no idea'));
        unwrap(await answer(game.id, bob.id, 'Artist t1 - Title t1'));

        expect(events.types().slice(-2)).toEqual(['answerReceived', 'allAnswered']);
        expect(scheduler.scheduled.map((s) => s.delayMs)).toEqual([2_000]);
        expect(game.currentSong?.isRevealed).toBe(false);

        await scheduler.runAll();

        expect(game.currentSong?.isRevealed).toBe(true);
        expect(events.types().at(-1)).toBe('songRevealed');
      });

      it('does nothing if the host revealed the song during the pause', async () => {
        const { game, host, alice, bob } = await twoPlayersOnASong();
        unwrap(await answer(game.id, alice.id, 'a'));
        unwrap(await answer(game.id, bob.id, 'b'));
        unwrap(await reveal(host));
        const before = events.types().length;

        await scheduler.runAll();

        expect(events.types()).toHaveLength(before);
      });

      it('does not reveal the next song if the host already moved on', async () => {
        const { game, host, alice, bob } = await twoPlayersOnASong();
        unwrap(await answer(game.id, alice.id, 'a'));
        unwrap(await answer(game.id, bob.id, 'b'));
        unwrap(await reveal(host));
        unwrap(await nextSong(host));

        await scheduler.runAll();

        expect(game.currentSong?.number).toBe(2);
        expect(game.currentSong?.isRevealed).toBe(false);
      });

      it('gives each player a single guess', async () => {
        const { game, alice } = await twoPlayersOnASong();
        unwrap(await answer(game.id, alice.id, 'first'));
        const second = await answer(game.id, alice.id, 'second');
        expect(!second.ok && second.error.code).toBe('ALREADY_ANSWERED');
      });
    });

    it('refuses answers after the reveal', async () => {
      const { game, host } = await launch();
      const { player } = unwrap(await join('Alice'));
      unwrap(await nextSong(host));
      unwrap(await reveal(host));
      const late = await answer(game.id, player.id, 'Title t1');
      expect(!late.ok && late.error.code).toBe('SONG_CLOSED');
      const twice = await reveal(host);
      expect(!twice.ok && twice.error.code).toBe('SONG_ALREADY_REVEALED');
    });
  });

  describe('FinishGame', () => {
    it('ends the party early once the current song is revealed', async () => {
      const { game, host } = await launch();
      unwrap(await nextSong(host));
      const tooSoon = await new FinishGame(games, events).execute(host);
      expect(!tooSoon.ok && tooSoon.error.code).toBe('SONG_IN_PROGRESS');
      unwrap(await reveal(host));
      unwrap(await new FinishGame(games, events).execute(host));
      expect(game.status).toBe('finished');
      expect(events.types().at(-1)).toBe('gameFinished');
    });
  });
});
