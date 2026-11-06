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

    it('gives each player a single guess per song', () => {
      unwrap(startSong());
      unwrap(answer('p1', T0 + 1, 'no idea'));
      expect(answer('p1', T0 + 2, 'second try')).toMatchObject({
        ok: false,
        error: { code: 'ALREADY_ANSWERED' },
      });
      expect(answer('p2', T0 + 3, 'my turn')).toMatchObject({ ok: true });
    });

    it('knows when everyone has answered the open song', () => {
      expect(game.everyoneHasAnswered()).toBe(false);
      unwrap(startSong());
      unwrap(answer('p1', T0 + 1, 'x'));
      expect(game.everyoneHasAnswered()).toBe(false);
      unwrap(answer('p2', T0 + 2, 'y'));
      expect(game.everyoneHasAnswered()).toBe(true);
      unwrap(game.revealSong(T0 + 3));
      expect(game.everyoneHasAnswered()).toBe(false);
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

    it('counts the points of the last song in the final scores', () => {
      const songs = [unwrap(startSong())];
      unwrap(game.revealSong(T0 + 1));
      songs.push(unwrap(startSong()));
      unwrap(game.revealSong(T0 + 1));
      const last = unwrap(startSong());
      unwrap(answer('p2', T0 + 5, last.track.title));
      unwrap(game.revealSong(T0 + 6));

      unwrap(game.finish());

      const final = game.scoreboard({ revealedOnly: true });
      expect(final[0]).toMatchObject({ player: { id: 'p2' } });
      expect(final[0]?.points).toBeGreaterThan(0);
      expect(final).toEqual(game.scoreboard({ revealedOnly: false }));
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
  describe('teams', () => {
    const teamPlan = (teamMode: boolean, songCount = 1): RoundPlan => ({
      ...plan(songCount),
      rules: unwrap(RoundRules.create({ ...ROUND_PRESETS.classic, songCount, teamMode })),
    });
    /** Always draws index 0: deterministic, whatever the shuffle does. */
    const random = { nextInt: () => 0 };
    const found = (song: { track: Track }) => `${song.track.artist} - ${song.track.title}`;
    const sizes = () => game.listTeams().map((team) => game.membersOf(team).length);

    beforeEach(() => {
      game = unwrap(createGame([teamPlan(true), teamPlan(false)]));
    });

    const joinPlayers = (count: number) =>
      Array.from({ length: count }, (_, i) => unwrap(join(`p${i + 1}`, `Player ${i + 1}`)));

    it('has no teams until the host generates them', () => {
      joinPlayers(3);
      expect(game.hasTeams).toBe(false);
      expect(game.teamOf('p1')).toBeUndefined();
      expect(game.teamScoreboard({ revealedOnly: false })).toEqual([]);
    });

    it('puts every player in a team and keeps the teams as even as possible', () => {
      joinPlayers(7);
      const teams = unwrap(game.generateTeams({ teamCount: 3, random }));
      expect(teams).toHaveLength(3);
      expect(sizes().sort()).toEqual([2, 2, 3]);
      for (let i = 1; i <= 7; i++) expect(game.teamOf(`p${i}`)).toBeDefined();
    });

    it('names each team differently', () => {
      joinPlayers(4);
      const teams = unwrap(game.generateTeams({ teamCount: 4, random }));
      expect(new Set(teams.map((team) => team.name)).size).toBe(4);
      expect(new Set(teams.map((team) => team.id)).size).toBe(4);
    });

    it('can be redone: the previous teams are replaced, not added to', () => {
      joinPlayers(4);
      unwrap(game.generateTeams({ teamCount: 2, random }));
      unwrap(game.generateTeams({ teamCount: 4, random }));
      expect(game.listTeams()).toHaveLength(4);
      expect(sizes()).toEqual([1, 1, 1, 1]);
    });

    it.each([0, 1, 5, 2.5, Number.NaN])('refuses %s teams', (teamCount) => {
      joinPlayers(6);
      const result = game.generateTeams({ teamCount, random });
      expect(!result.ok && result.error.code).toBe('INVALID_TEAM_COUNT');
    });

    it('needs at least one player per team', () => {
      joinPlayers(2);
      const result = game.generateTeams({ teamCount: 3, random });
      expect(!result.ok && result.error.code).toBe('NOT_ENOUGH_PLAYERS');
      expect(game.hasTeams).toBe(false);
    });

    it('is locked once the first song started', () => {
      joinPlayers(2);
      unwrap(game.generateTeams({ teamCount: 2, random }));
      unwrap(startSong());
      const result = game.generateTeams({ teamCount: 2, random });
      expect(!result.ok && result.error.code).toBe('TEAMS_LOCKED');
    });

    it('sends a latecomer to the smallest team', () => {
      joinPlayers(5);
      unwrap(game.generateTeams({ teamCount: 2, random }));
      const [big, small] = [...game.listTeams()].sort(
        (a, b) => game.membersOf(b).length - game.membersOf(a).length,
      );
      unwrap(join('late', 'Latecomer'));
      expect(game.teamOf('late')?.id).toBe(small?.id);
      expect(game.membersOf(big!)).toHaveLength(3);
      expect(sizes()).toEqual(expect.arrayContaining([3, 3]));
    });

    it('does not start a game with a team round before the teams exist', () => {
      joinPlayers(2);
      const refused = startSong();
      expect(!refused.ok && refused.error.code).toBe('TEAMS_REQUIRED');
      expect(game.status).toBe('lobby');

      unwrap(game.generateTeams({ teamCount: 2, random }));
      expect(startSong().ok).toBe(true);
    });

    it('does not ask for teams when no round uses the team mode', () => {
      game = unwrap(createGame([teamPlan(false)]));
      joinPlayers(2);
      expect(game.usesTeamMode).toBe(false);
      expect(startSong().ok).toBe(true);
    });

    describe('scores', () => {
      /** p1 finds both songs first; p2 (other team) never does. */
      const playBothRounds = () => {
        joinPlayers(2);
        unwrap(game.generateTeams({ teamCount: 2, random }));
        const first = unwrap(startSong());
        unwrap(answer('p1', T0 + 1, found(first)));
        unwrap(answer('p2', T0 + 2, 'no idea'));
        unwrap(game.revealSong(T0 + 3));
        const second = unwrap(startSong());
        unwrap(answer('p1', T0 + 4, found(second)));
        unwrap(game.revealSong(T0 + 5));
      };

      it('add up the points of team-mode rounds only', () => {
        playBothRounds();
        const team = game.teamOf('p1');
        const scores = game.teamScoreboard({ revealedOnly: true });

        // Individual scores keep both rounds; the team only keeps the team-mode one.
        expect(game.scoreboard({ revealedOnly: true })[0]).toMatchObject({ points: 4 });
        expect(scores[0]).toMatchObject({ team, points: 2 });
        expect(scores[1]).toMatchObject({ points: 0 });
      });

      it('hide the running song like the player scores do', () => {
        joinPlayers(2);
        unwrap(game.generateTeams({ teamCount: 2, random }));
        const song = unwrap(startSong());
        unwrap(answer('p1', T0 + 1, found(song)));

        expect(game.teamScoreboard({ revealedOnly: true }).map((s) => s.points)).toEqual([0, 0]);
        expect(game.teamScoreboard({ revealedOnly: false })[0]?.points).toBe(2);
      });

      it('are ranked in the recap, with ties sharing a rank', () => {
        playBothRounds();
        unwrap(game.finish());
        const standings = game.recap()?.teamStandings;
        expect(standings?.map((s) => [s.rank, s.points])).toEqual([
          [1, 2],
          [2, 0],
        ]);
      });

      it('are left out of the recap when no round was in team mode', () => {
        game = unwrap(createGame([teamPlan(false)]));
        joinPlayers(2);
        unwrap(game.generateTeams({ teamCount: 2, random }));
        unwrap(startSong());
        unwrap(game.revealSong(T0 + 1));
        unwrap(game.finish());
        expect(game.recap()?.teamStandings).toEqual([]);
      });
    });
  });
});
