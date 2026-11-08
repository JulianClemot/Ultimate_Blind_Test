import type { SongDto } from '@ubt/shared';
import { describe, expect, it } from 'vitest';

import { answer, gameRecap, playerSession } from '@/test/fixtures';

import { playerGameReducer } from './playerGameState';

const song: SongDto = {
  id: 's1',
  roundNumber: 1,
  roundName: '',
  roundType: 'classic',
  number: 1,
  songCount: 10,
  startedAt: 1_000,
  answerTimeSec: 30,
  asksTitle: true,
  asksArtist: true,
  revealed: false,
  suggestions: [],
};

const playing = playerSession({ status: 'playing', currentSong: song });

describe('playerGameReducer', () => {
  it('ignores events until rejoined', () => {
    expect(playerGameReducer(null, { type: 'songStarted', song })).toBeNull();
  });

  it('starts each song with no answer', () => {
    const withAnswer = playerGameReducer(playing, { type: 'answerSent', answer: answer() });
    const next = playerGameReducer(withAnswer, {
      type: 'songStarted',
      song: { ...song, id: 's2' },
    });
    expect(next).toMatchObject({ currentSong: { id: 's2' }, myAnswers: [], reveal: null });
  });

  it('keeps own answers of the current song once each', () => {
    let state = playerGameReducer(playing, { type: 'answerSent', answer: answer() });
    state = playerGameReducer(state, { type: 'answerSent', answer: answer() });
    state = playerGameReducer(state, {
      type: 'answerSent',
      answer: answer({ id: 'old', songId: 's0' }),
    });
    expect(state?.myAnswers.map((a) => a.id)).toEqual(['a1']);
  });

  it('flags that everyone answered, until the reveal or the next song', () => {
    const flagged = playerGameReducer(playing, { type: 'allAnswered', songId: 's1' });
    expect(flagged?.everyoneAnswered).toBe(true);
    expect(playerGameReducer(playing, { type: 'allAnswered', songId: 'other' })).toBe(playing);
    const next = playerGameReducer(flagged, { type: 'songStarted', song: { ...song, id: 's2' } });
    expect(next?.everyoneAnswered).toBe(false);
  });

  it('applies host corrections', () => {
    const state = playerGameReducer(playing, { type: 'answerSent', answer: answer() });
    const judged = playerGameReducer(state, {
      type: 'answerJudged',
      answer: answer({ verdict: { title: true, artist: true }, judgedByHost: true }),
    });
    expect(judged?.myAnswers[0]?.judgedByHost).toBe(true);
  });

  it('shows the reveal with its scores, then the final scores', () => {
    const scoreboard = [{ playerId: 'p1', playerName: 'Alice', points: 3 }];
    const revealed = playerGameReducer(playing, {
      type: 'songRevealed',
      reveal: { songId: 's1', title: 'Take On Me', artist: 'a-ha', scoreboard, teamScoreboard: [] },
    });
    expect(revealed).toMatchObject({
      currentSong: { revealed: true },
      reveal: { title: 'Take On Me' },
      scoreboard,
    });
    expect(playerGameReducer(revealed, { type: 'gameFinished', scoreboard })?.status).toBe(
      'finished',
    );
  });
});

describe('playerGameReducer recap', () => {
  it('keeps the recap sent when the game ends, and the latest one after a correction', () => {
    const finished = playerGameReducer(playerSession({ status: 'playing' }), {
      type: 'gameFinished',
      scoreboard: [],
    });
    expect(finished?.recap).toBeNull();

    const recap = gameRecap();
    const withRecap = playerGameReducer(finished, { type: 'recapReceived', recap });
    expect(withRecap?.recap).toBe(recap);

    const corrected = gameRecap({ gameName: 'Updated' });
    expect(playerGameReducer(withRecap, { type: 'recapReceived', recap: corrected })?.recap).toBe(
      corrected,
    );
  });

  describe('teams', () => {
    const flamingos = {
      id: 'team-1',
      name: 'The Funky Flamingos',
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    };
    const llamas = {
      id: 'team-2',
      name: 'The Neon Llamas',
      players: [{ id: 'p3', name: 'Chloé' }],
    };

    it("finds the player's own team when teams are drawn", () => {
      const state = playerGameReducer(playerSession(), {
        type: 'teamsUpdated',
        teams: [llamas, flamingos],
      });
      expect(state).toMatchObject({ teams: [llamas, flamingos], myTeamId: 'team-1' });
    });

    it('follows the player to a new team when the host reshuffles', () => {
      const drawn = playerGameReducer(playerSession(), {
        type: 'teamsUpdated',
        teams: [flamingos, llamas],
      });
      const reshuffled = playerGameReducer(drawn, {
        type: 'teamsUpdated',
        teams: [
          { ...flamingos, players: [{ id: 'p2', name: 'Bob' }] },
          {
            ...llamas,
            players: [
              { id: 'p3', name: 'Chloé' },
              { id: 'p1', name: 'Alice' },
            ],
          },
        ],
      });
      expect(reshuffled?.myTeamId).toBe('team-2');
    });

    it('keeps no team when the player is in none', () => {
      const state = playerGameReducer(playerSession(), { type: 'teamsUpdated', teams: [llamas] });
      expect(state?.myTeamId).toBeNull();
    });

    it('takes the team scores from the reveal and from corrections', () => {
      const teamScoreboard = [{ teamId: 'team-1', teamName: 'The Funky Flamingos', points: 3 }];
      const revealed = playerGameReducer(playing, {
        type: 'songRevealed',
        reveal: { songId: 's1', title: 'T', artist: 'A', scoreboard: [], teamScoreboard },
      });
      expect(revealed?.teamScoreboard).toEqual(teamScoreboard);
      expect(
        playerGameReducer(revealed, { type: 'teamScoresUpdated', teamScoreboard: [] })
          ?.teamScoreboard,
      ).toEqual([]);
    });
  });
});
