import { describe, expect, it } from 'vitest';

import type { RoundPlan } from '../design/RoundPlan';
import { ROUND_PRESETS, RoundRules } from '../design/RoundRules';
import { PlaylistId } from '../music/PlaylistId';
import type { Track } from '../music/Track';
import { Game } from './Game';
import { GameCode } from './GameCode';
import { PlayerName } from './PlayerName';
import type { GameRecap, SuperlativeKind } from './recap';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }) => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const track = (n: number): Track => ({
  id: `t${n}`,
  title: `Title ${n}`,
  artist: `Artist ${n}`,
  previewUrl: `https://cdn.test/${n}.mp3`,
});

/** Everyone scores: 2 points for a full find (1 per part), no bonus, so points are easy to read. */
const plan = (songCount: number): RoundPlan => ({
  type: 'everyone',
  playlist: unwrap(PlaylistId.parse('42')),
  name: 'Warm-up',
  playlistTitle: null,
  rules: unwrap(
    RoundRules.create({
      ...ROUND_PRESETS.everyone,
      songCount,
      titlePoints: 1,
      artistPoints: 1,
      speedBonus: 0,
      bothBonus: 0,
    }),
  ),
});

type Move = readonly [
  player: 'alice' | 'bob' | 'chloe',
  elapsedMs: number,
  kind: 'hit' | 'miss' | 'title',
];

describe('game recap', () => {
  let game: Game;
  let songNumber = 0;

  const names = { alice: 'Alice', bob: 'Bob', chloe: 'Chloé' } as const;

  const newGame = (songCount: number, players: (keyof typeof names)[]) => {
    game = unwrap(
      Game.create({
        id: 'g1',
        code: unwrap(GameCode.create('ABCDEF')),
        hostToken: 'secret',
        createdAt: 0,
        name: 'Friday night',
        rounds: [plan(songCount)],
      }),
    );
    songNumber = 0;
    for (const key of players) {
      unwrap(
        game.addPlayer({ playerId: key, name: unwrap(PlayerName.create(names[key])), joinedAt: 0 }),
      );
    }
  };

  /** Plays one song: answers land `elapsedMs` after the song start. Reveals it at the end. */
  const playSong = (moves: readonly Move[]) => {
    songNumber += 1;
    const startedAt = songNumber * 100_000;
    const song = unwrap(
      game.startSong({ songId: `s${songNumber}`, startedAt, track: track(songNumber) }),
    );
    moves.forEach(([player, elapsedMs, kind], index) => {
      const text =
        kind === 'hit'
          ? `${song.track.artist} ${song.track.title}`
          : kind === 'title'
            ? song.track.title
            : 'no idea';
      unwrap(
        game.submitAnswer({
          answerId: `a${songNumber}-${index}`,
          playerId: player,
          text,
          receivedAt: startedAt + elapsedMs,
          clientSentAt: 0,
        }),
      );
    });
    unwrap(game.revealSong(startedAt + 29_000));
  };

  const finish = (): GameRecap => {
    unwrap(game.finish());
    const recap = game.recap();
    if (!recap) throw new Error('expected a recap');
    return recap;
  };

  const award = (recap: GameRecap, kind: SuperlativeKind) =>
    recap.superlatives.find((s) => s.kind === kind);

  it('does not exist while the game is not finished', () => {
    newGame(2, ['alice']);
    expect(game.recap()).toBeUndefined();
    playSong([['alice', 1_000, 'hit']]);
    expect(game.recap()).toBeUndefined();
  });

  describe('standings', () => {
    it('ranks players by points and lets ties share a rank', () => {
      newGame(1, ['alice', 'bob', 'chloe']);
      playSong([
        ['bob', 2_000, 'hit'],
        ['alice', 3_000, 'hit'],
        ['chloe', 4_000, 'miss'],
      ]);

      const { standings } = finish();

      expect(standings.map((s) => [s.player.id, s.rank, s.points])).toEqual([
        ['alice', 1, 2],
        ['bob', 1, 2],
        ['chloe', 3, 0],
      ]);
    });
  });

  describe('track replay', () => {
    it('lists each song with what every player did', () => {
      newGame(2, ['alice', 'bob', 'chloe']);
      playSong([
        ['alice', 6_000, 'hit'],
        ['bob', 2_000, 'title'],
        ['chloe', 7_000, 'miss'],
      ]);
      playSong([['chloe', 1_500, 'hit']]);

      const { songs } = finish();

      expect(songs).toHaveLength(2);
      expect(songs[0]).toMatchObject({
        songId: 's1',
        roundNumber: 1,
        roundName: 'Warm-up',
        number: 1,
        title: 'Title 1',
        artist: 'Artist 1',
      });
      expect(songs[0]?.results.map((r) => r.player.id)).toEqual(['bob', 'alice', 'chloe']);
      expect(songs[0]?.results[0]).toEqual({
        player: expect.objectContaining({ id: 'bob' }) as unknown,
        points: 1,
        foundTitle: true,
        foundArtist: false,
        foundAtMs: 2_000,
        wrongAttempts: 0,
      });
      expect(songs[0]?.results[1]).toMatchObject({
        points: 2,
        foundTitle: true,
        foundArtist: true,
        foundAtMs: 6_000,
        wrongAttempts: 0,
      });
      expect(songs[0]?.results[2]).toMatchObject({ foundAtMs: null, points: 0, wrongAttempts: 1 });
      expect(songs[1]?.results[0]).toMatchObject({ player: { id: 'chloe' }, foundAtMs: 1_500 });
    });

    it('takes host corrections into account, even after the end', () => {
      newGame(1, ['alice', 'bob']);
      playSong([['alice', 3_000, 'miss']]);
      unwrap(game.finish());

      unwrap(game.judgeAnswer('a1-0', { title: true, artist: true }));

      const recap = game.recap();
      expect(recap?.songs[0]?.results[0]).toMatchObject({
        player: { id: 'alice' },
        foundAtMs: 3_000,
        wrongAttempts: 0,
        points: 2,
      });
      expect(recap?.standings[0]).toMatchObject({ rank: 1, points: 2 });
    });
  });

  describe('superlatives', () => {
    describe('fastest finger', () => {
      it('goes to the lowest average find time', () => {
        newGame(3, ['alice', 'bob']);
        playSong([
          ['alice', 1_000, 'hit'],
          ['bob', 4_000, 'hit'],
        ]);
        playSong([
          ['alice', 2_000, 'hit'],
          ['bob', 4_000, 'hit'],
        ]);
        playSong([
          ['alice', 3_000, 'hit'],
          ['bob', 4_000, 'hit'],
        ]);

        expect(award(finish(), 'fastest-finger')).toMatchObject({
          player: { id: 'alice' },
          value: 2_000,
        });
      });

      it('ignores players who found fewer than two songs', () => {
        newGame(3, ['alice', 'bob']);
        playSong([
          ['alice', 5_000, 'hit'],
          ['bob', 100, 'hit'],
        ]);
        playSong([['alice', 5_000, 'hit']]);
        playSong([['alice', 5_000, 'hit']]);

        expect(award(finish(), 'fastest-finger')).toMatchObject({ player: { id: 'alice' } });
      });

      it('needs only one found song when only one was played', () => {
        newGame(1, ['alice', 'bob']);
        playSong([['bob', 900, 'hit']]);

        expect(award(finish(), 'fastest-finger')).toMatchObject({
          player: { id: 'bob' },
          value: 900,
        });
      });

      it('is not given when nobody found anything', () => {
        newGame(1, ['alice', 'bob']);
        playSong([['alice', 900, 'miss']]);

        expect(award(finish(), 'fastest-finger')).toBeUndefined();
      });
    });

    describe('sniper', () => {
      it('goes to the player who found the most songs first', () => {
        newGame(3, ['alice', 'bob']);
        playSong([
          ['alice', 1_000, 'hit'],
          ['bob', 2_000, 'hit'],
        ]);
        playSong([
          ['bob', 3_000, 'hit'],
          ['alice', 1_000, 'hit'],
        ]);
        playSong([
          ['bob', 1_000, 'hit'],
          ['alice', 2_000, 'hit'],
        ]);

        expect(award(finish(), 'sniper')).toMatchObject({ player: { id: 'alice' }, value: 2 });
      });

      it('is not given when nobody found a song', () => {
        newGame(1, ['alice', 'bob']);
        playSong([['alice', 1_000, 'miss']]);

        expect(award(finish(), 'sniper')).toBeUndefined();
      });
    });

    describe('stubborn', () => {
      it('goes to the player with the most wrong attempts', () => {
        newGame(4, ['alice', 'bob']);
        playSong([
          ['bob', 1_000, 'miss'],
          ['alice', 4_000, 'miss'],
        ]);
        playSong([['bob', 1_000, 'miss']]);
        playSong([['bob', 1_000, 'miss']]);
        playSong([['bob', 1_000, 'miss']]);

        expect(award(finish(), 'stubborn')).toMatchObject({ player: { id: 'bob' }, value: 4 });
      });

      it('needs at least 3 wrong attempts', () => {
        newGame(2, ['alice', 'bob']);
        playSong([['bob', 1_000, 'miss']]);
        playSong([['bob', 1_000, 'miss']]);

        expect(award(finish(), 'stubborn')).toBeUndefined();
      });
    });

    describe('comeback kid', () => {
      it('goes to the player who gained the most places since a checkpoint', () => {
        newGame(5, ['alice', 'bob', 'chloe']);
        playSong([
          ['alice', 1_000, 'hit'],
          ['bob', 2_000, 'hit'],
        ]);
        playSong([
          ['alice', 1_000, 'hit'],
          ['bob', 2_000, 'hit'],
        ]);
        playSong([['chloe', 1_000, 'hit']]);
        playSong([['chloe', 1_000, 'hit']]);
        playSong([['chloe', 1_000, 'hit']]);

        const recap = finish();

        expect(recap.standings[0]).toMatchObject({ rank: 1, player: { id: 'chloe' } });
        expect(award(recap, 'comeback-kid')).toMatchObject({ player: { id: 'chloe' }, value: 2 });
      });

      it('needs at least 2 places gained', () => {
        newGame(3, ['alice', 'bob']);
        playSong([['alice', 1_000, 'hit']]);
        playSong([['bob', 1_000, 'hit']]);
        playSong([['bob', 1_000, 'hit']]);

        const recap = finish();

        // Bob was 2nd after song 1 and ends 1st: one place is not a comeback.
        expect(recap.standings[0]).toMatchObject({ player: { id: 'bob' } });
        expect(award(recap, 'comeback-kid')).toBeUndefined();
      });
    });

    it('breaks ties with the better final standing', () => {
      newGame(3, ['alice', 'bob', 'chloe']);
      for (let i = 0; i < 3; i++) {
        playSong([
          ['alice', 1_000, 'hit'],
          ['bob', 1_000, 'miss'],
          ['chloe', 2_000, 'miss'],
        ]);
      }

      // Bob and Chloé both have 3 wrong attempts and 0 points: the name order decides.
      expect(award(finish(), 'stubborn')).toMatchObject({ player: { id: 'bob' }, value: 3 });
    });

    it('gives no award in a solo game', () => {
      newGame(2, ['alice']);
      playSong([['alice', 1_000, 'hit']]);
      playSong([['alice', 1_000, 'hit']]);

      expect(finish().superlatives).toEqual([]);
    });
  });
});
