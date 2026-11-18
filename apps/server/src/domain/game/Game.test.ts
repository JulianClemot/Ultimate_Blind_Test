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
  sourceOverrides: {},
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

  describe('removing a player', () => {
    it('works in the lobby: the player and their team are gone', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(join('p2', 'Bob'));
      const removed = unwrap(game.removePlayer('p1'));
      expect(removed.name.value).toBe('Alice');
      expect(game.listPlayers().map((p) => p.id)).toEqual(['p2']);
      expect(game.findPlayer('p1')).toBeUndefined();
    });

    it('works while a song is running, and drops their answer from the ranking', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(join('p2', 'Bob'));
      unwrap(startSong());
      unwrap(answer('p1', T0 + 1, 'Title t1'));
      unwrap(answer('p2', T0 + 2, 'Title t1'));
      unwrap(game.removePlayer('p1'));
      unwrap(game.revealSong(T0 + 10));
      const [first, ...others] = game.scoreboard({ revealedOnly: true });
      expect(others).toHaveLength(0);
      expect(first?.player.id).toBe('p2');
      // Bob is now the fastest: he gets the points Alice would have taken.
      expect(first?.points).toBeGreaterThan(0);
      expect(game.currentSong?.hasAnswered('p1')).toBe(false);
    });

    it('works between two songs and keeps the other scores', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(join('p2', 'Bob'));
      unwrap(startSong());
      unwrap(answer('p2', T0 + 2, 'Title t1'));
      unwrap(game.revealSong(T0 + 10));
      const before = game.scoreboard({ revealedOnly: true }).find((s) => s.player.id === 'p2');
      unwrap(game.removePlayer('p1'));
      const after = game.scoreboard({ revealedOnly: true });
      expect(after.map((s) => s.player.id)).toEqual(['p2']);
      expect(after[0]?.points).toBe(before?.points);
    });

    it('cannot be undone by joining again under the same name', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(game.removePlayer('p1'));
      const again = join('p9', 'alice');
      expect(!again.ok && again.error.code).toBe('PLAYER_KICKED');
      expect(join('p10', 'Bob').ok).toBe(true);
    });

    it('stops the player from answering', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(startSong());
      unwrap(game.removePlayer('p1'));
      const result = answer('p1', T0 + 1, 'Title t1');
      expect(!result.ok && result.error.code).toBe('UNKNOWN_PLAYER');
    });

    it('makes everyone-has-answered true when the last one missing is removed', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(join('p2', 'Bob'));
      unwrap(startSong());
      unwrap(answer('p1', T0 + 1, 'Title t1'));
      expect(game.everyoneHasAnswered()).toBe(false);
      unwrap(game.removePlayer('p2'));
      expect(game.everyoneHasAnswered()).toBe(true);
    });

    it('takes the player out of their team', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(join('p2', 'Bob'));
      unwrap(join('p3', 'Chloé'));
      unwrap(game.generateTeams({ teamCount: 2, random: { nextInt: () => 0 } }));
      unwrap(game.removePlayer('p1'));
      const members = game.listTeams().flatMap((team) => game.membersOf(team).map((p) => p.id));
      expect(members.sort()).toEqual(['p2', 'p3']);
    });

    it('refuses an unknown player', () => {
      const result = game.removePlayer('ghost');
      expect(!result.ok && result.error.code).toBe('UNKNOWN_PLAYER');
    });

    it('is refused once the game is over', () => {
      unwrap(join('p1', 'Alice'));
      unwrap(game.close());
      const result = game.removePlayer('p1');
      expect(!result.ok && result.error.code).toBe('GAME_FINISHED');
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

    it('can be closed at once, even mid-song, but only once', () => {
      unwrap(startSong());
      unwrap(game.close());
      expect(game.status).toBe('finished');
      expect(game.close()).toMatchObject({ ok: false, error: { code: 'GAME_FINISHED' } });
      expect(startSong()).toMatchObject({ ok: false, error: { code: 'GAME_FINISHED' } });
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
        verdict: { title: true, artist: true, source: false },
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

      const judged = unwrap(
        game.judgeAnswer(wrong.id, { title: true, artist: false, source: false }),
      );

      expect(judged).toMatchObject({
        verdict: { title: true, artist: false, source: false },
        judgedByHost: true,
      });
      expect(game.scoreboard({ revealedOnly: false })[0]).toMatchObject({
        player: { id: 'p1' },
        points: ROUND_PRESETS.classic.titlePoints,
      });
      expect(game.judgeAnswer('nope', { title: true, artist: true, source: false })).toMatchObject({
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

    describe('host adjustments', () => {
      beforeEach(() => {
        joinPlayers(5);
        unwrap(game.generateTeams({ teamCount: 2, random }));
      });

      it('renames a team, trimming and collapsing spaces', () => {
        unwrap(game.renameTeam({ teamId: 'team-1', name: '  Les   Rois  ' }));
        expect(game.listTeams().find((t) => t.id === 'team-1')?.name).toBe('Les Rois');
        expect(game.teamOf('p1')?.id).toBeDefined();
      });

      it.each(['', '   ', 'x'.repeat(31)])('refuses the team name %j', (name) => {
        const result = game.renameTeam({ teamId: 'team-1', name });
        expect(!result.ok && result.error.code).toBe('INVALID_TEAM_NAME');
      });

      it('refuses a name another team already has, ignoring case', () => {
        const other = game.listTeams().find((t) => t.id === 'team-2')!;
        const result = game.renameTeam({ teamId: 'team-1', name: other.name.toUpperCase() });
        expect(!result.ok && result.error.code).toBe('TEAM_NAME_TAKEN');
      });

      it('lets a team keep its own name', () => {
        const own = game.listTeams().find((t) => t.id === 'team-1')!;
        unwrap(game.renameTeam({ teamId: 'team-1', name: own.name }));
      });

      it('refuses to rename an unknown team', () => {
        const result = game.renameTeam({ teamId: 'team-9', name: 'Ghosts' });
        expect(!result.ok && result.error.code).toBe('UNKNOWN_TEAM');
      });

      const idsOf = (teamId: string) =>
        game.membersOf(game.listTeams().find((t) => t.id === teamId)!).map((p) => p.id);

      it('moves players to another team', () => {
        const from = game.teamOf('p1')!;
        const to = game.listTeams().find((t) => t.id !== from.id)!;
        unwrap(game.movePlayers({ playerIds: ['p1'], teamId: to.id }));
        expect(game.teamOf('p1')).toEqual(to);
        expect(idsOf(from.id)).not.toContain('p1');
      });

      it('moves several players at once', () => {
        const ids = idsOf('team-1').slice(0, 2);
        unwrap(game.movePlayers({ playerIds: ids, teamId: 'team-2' }));
        expect(idsOf('team-2')).toEqual(expect.arrayContaining(ids));
        expect(idsOf('team-1')).toHaveLength(1);
        expect(idsOf('team-1')).toEqual(expect.not.arrayContaining(ids));
      });

      it('accepts a selection from several teams, some already at the destination', () => {
        const mixed = [idsOf('team-1')[0]!, idsOf('team-2')[0]!];
        unwrap(game.movePlayers({ playerIds: mixed, teamId: 'team-2' }));
        expect(idsOf('team-2')).toEqual(expect.arrayContaining(mixed));
        expect(idsOf('team-1').length).toBeGreaterThan(0);
      });

      it('does nothing when the players are already in that team', () => {
        const before = idsOf('team-1');
        unwrap(game.movePlayers({ playerIds: before, teamId: 'team-1' }));
        expect(idsOf('team-1')).toEqual(before);
      });

      it('never leaves a team without players', () => {
        const result = game.movePlayers({ playerIds: idsOf('team-2'), teamId: 'team-1' });
        expect(!result.ok && result.error.code).toBe('TEAM_WOULD_BE_EMPTY');
        expect(idsOf('team-2').length).toBeGreaterThan(0);
      });

      it('moves all or none: a refused move changes nobody', () => {
        const before = { one: idsOf('team-1'), two: idsOf('team-2') };
        // The second player is unknown: the first must not move either.
        const unknown = game.movePlayers({
          playerIds: [before.two[0]!, 'nobody'],
          teamId: 'team-1',
        });
        expect(!unknown.ok && unknown.error.code).toBe('UNKNOWN_PLAYER');
        const emptying = game.movePlayers({ playerIds: before.two, teamId: 'team-1' });
        expect(!emptying.ok && emptying.error.code).toBe('TEAM_WOULD_BE_EMPTY');
        expect({ one: idsOf('team-1'), two: idsOf('team-2') }).toEqual(before);
      });

      it('refuses an unknown team', () => {
        const noTeam = game.movePlayers({ playerIds: ['p1'], teamId: 'team-9' });
        expect(!noTeam.ok && noTeam.error.code).toBe('UNKNOWN_TEAM');
      });

      it('is locked once the first song started', () => {
        unwrap(startSong());
        const rename = game.renameTeam({ teamId: 'team-1', name: 'Too late' });
        expect(!rename.ok && rename.error.code).toBe('TEAMS_LOCKED');
        const move = game.movePlayers({ playerIds: ['p1'], teamId: 'team-2' });
        expect(!move.ok && move.error.code).toBe('TEAMS_LOCKED');
      });

      it('is refused before teams exist', () => {
        const fresh = unwrap(createGame([teamPlan(true)]));
        const result = fresh.renameTeam({ teamId: 'team-1', name: 'Nobody' });
        expect(!result.ok && result.error.code).toBe('UNKNOWN_TEAM');
      });
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

  describe('easy rounds', () => {
    const tracks = [track('c'), track('a'), track('b')];

    const easyGame = () => {
      const rules = unwrap(
        RoundRules.create({ ...ROUND_PRESETS.classic, songCount: 2, easyMode: true }),
      );
      game = unwrap(createGame([{ ...plan(2), rules }, plan(1)]));
      unwrap(join('p1', 'Alice'));
    };

    const start = (songId: string, track: Track) =>
      game.startSong({ songId, startedAt: T0, track, playlistTracks: tracks });

    beforeEach(easyGame);

    it('offers the tracks of the playlist as suggestions, alphabetically', () => {
      unwrap(start('s1', track('b')));
      expect(game.currentRound?.suggestions.map(({ id, label }) => ({ id, label }))).toEqual([
        { id: 'a', label: 'Artist a – Title a' },
        { id: 'b', label: 'Artist b – Title b' },
        { id: 'c', label: 'Artist c – Title c' },
      ]);
    });

    it('keeps the suggestions of the first song for the whole round', () => {
      unwrap(start('s1', track('b')));
      unwrap(game.revealSong(T0 + 1));
      unwrap(
        game.startSong({ songId: 's2', startedAt: T0, track: track('a'), playlistTracks: [] }),
      );
      expect(game.currentRound?.suggestions).toHaveLength(3);
    });

    it('turns a picked suggestion into an assisted answer', () => {
      unwrap(start('s1', track('b')));
      const right = unwrap(
        game.submitAnswer({
          answerId: 'a1',
          playerId: 'p1',
          text: 'ignored',
          suggestionId: 'b',
          receivedAt: T0 + 5,
          clientSentAt: 0,
        }),
      );
      expect(right).toMatchObject({
        text: 'Artist b – Title b',
        assisted: true,
        verdict: { title: true, artist: true, source: false },
      });
    });

    it('judges a wrong pick like any other answer', () => {
      unwrap(start('s1', track('b')));
      const wrong = unwrap(
        game.submitAnswer({
          answerId: 'a1',
          playerId: 'p1',
          text: '',
          suggestionId: 'c',
          receivedAt: T0 + 5,
          clientSentAt: 0,
        }),
      );
      expect(wrong).toMatchObject({ assisted: true, verdict: { title: false, artist: false } });
    });

    it('judges a pick exactly: a near-identical title is not the song', () => {
      game = unwrap(
        createGame([
          {
            ...plan(1),
            rules: unwrap(RoundRules.create({ ...ROUND_PRESETS.classic, easyMode: true })),
          },
        ]),
      );
      unwrap(join('p1', 'Alice'));
      const song: Track = { ...track('1'), title: 'Hello', artist: 'Adele' };
      const lookalike: Track = { ...track('2'), title: 'Hella', artist: 'Adele' };
      unwrap(
        game.startSong({
          songId: 's1',
          startedAt: T0,
          track: song,
          playlistTracks: [song, lookalike],
        }),
      );
      const pick = unwrap(
        game.submitAnswer({
          answerId: 'a1',
          playerId: 'p1',
          text: '',
          suggestionId: '2',
          receivedAt: T0 + 5,
          clientSentAt: 0,
        }),
      );
      expect(pick.verdict).toEqual({ title: false, artist: true, source: false });
    });

    it('refuses a suggestion the round does not offer', () => {
      unwrap(start('s1', track('b')));
      const result = game.submitAnswer({
        answerId: 'a1',
        playerId: 'p1',
        text: 'x',
        suggestionId: 'zzz',
        receivedAt: T0 + 5,
        clientSentAt: 0,
      });
      expect(!result.ok && result.error.code).toBe('UNKNOWN_SUGGESTION');
    });

    it('still takes typed answers, scored without assistance', () => {
      unwrap(start('s1', track('b')));
      expect(unwrap(answer('p1', T0 + 5, 'Artist b - Title b'))).toMatchObject({
        assisted: false,
        verdict: { title: true, artist: true, source: false },
      });
    });

    it('offers nothing in a round that is not easy', () => {
      unwrap(start('s1', track('b')));
      unwrap(game.revealSong(T0 + 1));
      unwrap(start('s2', track('a')));
      unwrap(game.revealSong(T0 + 1));
      unwrap(start('s3', track('c')));
      expect(game.currentRound?.suggestions).toEqual([]);
      const result = game.submitAnswer({
        answerId: 'a1',
        playerId: 'p1',
        text: 'x',
        suggestionId: 'a',
        receivedAt: T0 + 5,
        clientSentAt: 0,
      });
      expect(!result.ok && result.error.code).toBe('UNKNOWN_SUGGESTION');
    });
  });

  describe('rounds about films and series', () => {
    const frozenSong: Track = {
      ...track('f1'),
      source: { name: 'Frozen', aliases: ['La Reine des Neiges'], medium: 'movie' },
    };
    const sequel: Track = {
      ...track('f2'),
      source: { name: 'Frozen 2', aliases: [], medium: 'movie' },
    };
    const tangled: Track = {
      ...track('f3'),
      source: { name: 'Tangled', aliases: [], medium: 'movie' },
    };

    const screenGame = (easyMode = false) => {
      const rules = unwrap(RoundRules.create({ ...ROUND_PRESETS.screen, songCount: 2, easyMode }));
      game = unwrap(createGame([{ ...plan(2), type: 'screen', rules }]));
      unwrap(join('p1', 'Alice'));
      return game.startSong({
        songId: 's1',
        startedAt: T0,
        track: frozenSong,
        playlistTracks: [frozenSong, sequel, tangled, track('plain')],
      });
    };

    const pick = (suggestionId: string) =>
      game.submitAnswer({
        answerId: 'a1',
        playerId: 'p1',
        text: '',
        suggestionId,
        receivedAt: T0 + 5,
        clientSentAt: 0,
      });

    it('checks free text against the film and its aliases', () => {
      unwrap(screenGame());
      expect(unwrap(answer('p1', T0 + 5, 'la reine des neiges')).verdict).toEqual({
        title: false,
        artist: false,
        source: true,
      });
    });

    it('proposes the distinct names of the films, never a track without one', () => {
      unwrap(screenGame(true));
      expect(game.currentRound?.suggestions.map(({ label }) => label)).toEqual([
        'Frozen',
        'Frozen 2',
        'Tangled',
      ]);
    });

    it('judges a picked film exactly: Frozen 2 is not Frozen', () => {
      unwrap(screenGame(true));
      const wrong = unwrap(pick('frozen 2'));
      expect(wrong).toMatchObject({ assisted: true, verdict: { source: false } });
    });

    it('credits the right pick, without bonus', () => {
      unwrap(screenGame(true));
      expect(unwrap(pick('frozen'))).toMatchObject({
        text: 'Frozen',
        assisted: true,
        verdict: { source: true },
      });
      unwrap(game.revealSong(T0 + 10));
      expect(game.scoreboard({ revealedOnly: true })[0]?.points).toBe(
        ROUND_PRESETS.screen.sourcePoints,
      );
    });

    it('shows the film in the recap', () => {
      unwrap(screenGame());
      unwrap(answer('p1', T0 + 5, 'Frozen'));
      unwrap(game.revealSong(T0 + 10));
      unwrap(game.finish());
      const recap = game.recap();
      expect(recap?.songs[0]).toMatchObject({ source: 'Frozen' });
      expect(recap?.songs[0]?.results[0]).toMatchObject({ foundSource: true, foundAtMs: 5 });
    });
  });
});
