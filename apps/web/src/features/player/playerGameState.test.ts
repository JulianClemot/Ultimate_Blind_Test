import type { SongDto } from '@ubt/shared';
import { describe, expect, it } from 'vitest';

import { answer, playerSession } from '@/test/fixtures';

import { hasFoundEverything, playerGameReducer } from './playerGameState';

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
      reveal: { songId: 's1', title: 'Take On Me', artist: 'a-ha', scoreboard },
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

describe('hasFoundEverything', () => {
  it('needs every asked part, across attempts', () => {
    const titleOnly = answer({ verdict: { title: true, artist: false } });
    const artistOnly = answer({ id: 'a2', verdict: { title: false, artist: true } });
    expect(hasFoundEverything(song, [titleOnly])).toBe(false);
    expect(hasFoundEverything(song, [titleOnly, artistOnly])).toBe(true);
    expect(hasFoundEverything({ ...song, asksArtist: false }, [titleOnly])).toBe(true);
  });
});
