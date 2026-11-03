import { beforeEach, describe, expect, it } from 'vitest';

import type { RoundPlan } from '../design/RoundPlan';
import { ROUND_PRESETS, RoundRules, type RoundType } from '../design/RoundRules';
import { PlaylistId } from '../music/PlaylistId';
import type { Track } from '../music/Track';
import { Game } from './Game';
import { GameCode } from './GameCode';
import { PlayerName } from './PlayerName';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }) => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const T0 = 1_000;

const track = (id: string): Track => ({
  id,
  title: `Title ${id}`,
  artist: `Artist ${id}`,
  previewUrl: `https://cdn.test/${id}.mp3`,
});

const plan = (songCount: number, type: RoundType = 'classic'): RoundPlan => ({
  type,
  playlist: unwrap(PlaylistId.parse('42')),
  name: 'Warm-up',
  playlistTitle: null,
  rules: unwrap(RoundRules.create({ ...ROUND_PRESETS[type], songCount })),
});

describe('Game', () => {
  let game: Game;

  const createGame = (rounds: RoundPlan[]) =>
    Game.create({
      id: 'game-1',
      code: unwrap(GameCode.create('ABCDEF')),
      hostToken: 'secret',
      createdAt: T0,
      name: 'Friday night',
      rounds,
    });

  beforeEach(() => {
    game = unwrap(createGame([plan(2), plan(1, 'everyone')]));
  });

  const join = (playerId: string, name: string) =>
    game.addPlayer({ playerId, name: unwrap(PlayerName.create(name)), joinedAt: T0 });

  let songCounter = 0;
  const startSong = (at = T0) => {
    songCounter += 1;
    return game.startSong({
      songId: `s${songCounter}`,
      startedAt: at,
      track: track(`t${songCounter}`),
    });
  };

  const answer = (playerId: string, receivedAt: number, text: string) =>
    game.submitAnswer({
      answerId: `a-${playerId}-${receivedAt}`,
      playerId,
      text,
      receivedAt,
      clientSentAt: 0,
    });

  it('needs at least one round', () => {
    const result = createGame([]);
    expect(!result.ok && result.error.code).toBe('EMPTY_DESIGN');
  });

  it('starts in the lobby without players', () => {
    expect(game.status).toBe('lobby');
    expect(game.listPlayers()).toHaveLength(0);
    expect(game.upcomingRound?.number).toBe(1);
  });

  it('authenticates the host by token', () => {
    expect(game.isHost('secret')).toBe(true);
    expect(game.isHost('guess')).toBe(false);
  });

  describe('joining', () => {
    it('refuses duplicated names regardless of case', () => {
      unwrap(join('p1', 'Alice'));
      const result = join('p2', 'ALICE');
      expect(!result.ok && result.error.code).toBe('PLAYER_NAME_TAKEN');
    });

    it('refuses players beyond capacity', () => {
      for (let i = 0; i < Game.MAX_PLAYERS; i++) unwrap(join(`p${i}`, `Player ${i}`));
      const result = join('extra', 'One too many');
      expect(!result.ok && result.error.code).toBe('GAME_FULL');
    });
  });

  describe('progression', () => {
    const playAndReveal = () => {
      const song = unwrap(startSong());
      unwrap(game.revealSong(T0 + 1));
      return song;
    };

    it('plays the songs of each round in order, then runs out', () => {
      const played = [playAndReveal(), playAndReveal(), playAndReveal()];
      expect(played.map((s) => [s.roundNumber, s.number])).toEqual([
        [1, 1],
        [1, 2],
        [2, 1],
      ]);
      expect(game.status).toBe('playing');
      expect(game.upcomingRound).toBeUndefined();
      const result = startSong();
      expect(!result.ok && result.error.code).toBe('GAME_FINISHED');
    });

    it('requires the current song to be revealed before moving on', () => {
      unwrap(startSong());
      expect(startSong()).toMatchObject({ ok: false, error: { code: 'SONG_IN_PROGRESS' } });
      expect(game.finish()).toMatchObject({ ok: false, error: { code: 'SONG_IN_PROGRESS' } });
    });

    it('can be finished early', () => {
      playAndReveal();
      unwrap(game.finish());
      expect(game.status).toBe('finished');
      expect(startSong()).toMatchObject({ ok: false, error: { code: 'GAME_FINISHED' } });
    });

    it('remembers played tracks', () => {
      playAndReveal();
      expect(game.hasPlayed(`t${songCounter}`)).toBe(true);
      expect(game.hasPlayed('other')).toBe(false);
    });
  });

  describe('answers', () => {
    beforeEach(() => {
      unwrap(join('p1', 'Alice'));
      unwrap(join('p2', 'Bob'));
    });

    it('refuses answers when no song is playing', () => {
      expect(answer('p1', T0, 'x')).toMatchObject({ ok: false, error: { code: 'NO_ACTIVE_SONG' } });
    });

    it('checks answers automatically and timestamps them from the song start', () => {
      const song = unwrap(startSong());
      const result = unwrap(
        answer('p1', T0 + 1234.5, `${song.track.artist} - ${song.track.title}`),
      );
      expect(result).toMatchObject({
        songId: song.id,
        elapsedMs: 1234.5,
        verdict: { title: true, artist: true },
        judgedByHost: false,
      });
    });

    it('lets players try again until they found everything', () => {
      const song = unwrap(startSong());
      expect(unwrap(answer('p1', T0 + 1, 'no idea')).verdict).toEqual({
        title: false,
        artist: false,
      });
      unwrap(answer('p1', T0 + 2, song.track.title));
      unwrap(answer('p1', T0 + 3, song.track.artist));
      expect(answer('p1', T0 + 4, 'again')).toMatchObject({
        ok: false,
        error: { code: 'ALREADY_FOUND' },
      });
    });

    it('closes answers at the end of the answer time and once revealed', () => {
      unwrap(startSong());
      const late = T0 + ROUND_PRESETS.classic.answerTimeSec * 1000 + 1;
      expect(answer('p1', late, 'x')).toMatchObject({ ok: false, error: { code: 'SONG_CLOSED' } });
      unwrap(game.revealSong(T0 + 10));
      expect(answer('p2', T0 + 11, 'x')).toMatchObject({
        ok: false,
        error: { code: 'SONG_CLOSED' },
      });
    });

    it('caps the number of attempts', () => {
      unwrap(startSong());
      for (let i = 0; i < 10; i++) unwrap(answer('p1', T0 + i, `guess ${i}`));
      expect(answer('p1', T0 + 20, 'one more')).toMatchObject({
        ok: false,
        error: { code: 'TOO_MANY_ATTEMPTS' },
      });
    });

    it('refuses answers from unknown players', () => {
      unwrap(startSong());
      expect(answer('ghost', T0 + 1, 'x')).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_PLAYER' },
      });
    });

    it('lets the host overrule a verdict, which updates the scores', () => {
      unwrap(startSong());
      const wrong = unwrap(answer('p1', T0 + 1, 'close enough'));
      expect(game.scoreboard({ revealedOnly: false })[0]?.points).toBe(0);

      const judged = unwrap(game.judgeAnswer(wrong.id, { title: true, artist: false }));

      expect(judged).toMatchObject({ verdict: { title: true, artist: false }, judgedByHost: true });
      expect(game.scoreboard({ revealedOnly: false })[0]).toMatchObject({
        player: { id: 'p1' },
        points: ROUND_PRESETS.classic.titlePoints,
      });
      expect(game.judgeAnswer('nope', { title: true, artist: true })).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_ANSWER' },
      });
    });

    it('shows players only the scores of revealed songs', () => {
      const song = unwrap(startSong());
      unwrap(answer('p2', T0 + 1, song.track.title));
      expect(game.scoreboard({ revealedOnly: true }).map((s) => s.points)).toEqual([0, 0]);
      expect(game.scoreboard({ revealedOnly: false })[0]?.player.id).toBe('p2');

      unwrap(game.revealSong(T0 + 2));
      expect(game.scoreboard({ revealedOnly: true })).toMatchObject([
        { player: { id: 'p2' }, points: 1 },
        { player: { id: 'p1' }, points: 0 },
      ]);
    });
  });
});
