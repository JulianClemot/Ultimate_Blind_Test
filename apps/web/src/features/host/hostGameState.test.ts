import { describe, expect, it } from 'vitest';

import { answer, gameRecap, hostSong, snapshot } from '@/test/fixtures';

import { hostGameReducer, type HostGameState } from './hostGameState';

const playing: HostGameState = snapshot({ status: 'playing', currentSong: hostSong() });
const reveal = { songId: 's1', title: 'One More Time', artist: 'Daft Punk', scoreboard: [] };

describe('hostGameReducer', () => {
  it('ignores events until attached', () => {
    expect(hostGameReducer(null, { type: 'playerJoined', player: { id: 'p', name: 'x' } })).toBe(
      null,
    );
  });

  it('adds joining players once, with a zero score', () => {
    const player = { id: 'p2', name: 'Bob' };
    const once = hostGameReducer(snapshot(), { type: 'playerJoined', player });
    const twice = hostGameReducer(once, { type: 'playerJoined', player });
    expect(twice?.players).toHaveLength(2);
    expect(twice?.scoreboard).toContainEqual({ playerId: 'p2', playerName: 'Bob', points: 0 });
  });

  it('starts a song with a clean slate and knows when it is the last one', () => {
    const withAnswer = hostGameReducer(playing, { type: 'answerReceived', answer: answer() });
    const next = hostGameReducer(withAnswer, {
      type: 'songStarted',
      song: hostSong({ id: 's2', number: 2 }),
    });
    expect(next).toMatchObject({
      currentSong: { id: 's2' },
      answers: [],
      reveal: null,
      hasNextSong: true,
    });

    const last = hostGameReducer(next, {
      type: 'songStarted',
      song: hostSong({ id: 's3', roundNumber: 2, number: 1, songCount: 1 }),
    });
    expect(last?.hasNextSong).toBe(false);
  });

  it('keeps answers of the current song sorted by server reception time', () => {
    let state = hostGameReducer(playing, {
      type: 'answerReceived',
      answer: answer({ id: 'a2', receivedAt: 3_000 }),
    });
    state = hostGameReducer(state, {
      type: 'answerReceived',
      answer: answer({ id: 'a1', receivedAt: 2_000 }),
    });
    state = hostGameReducer(state, {
      type: 'answerReceived',
      answer: answer({ id: 'old', songId: 's0' }),
    });
    expect(state?.answers.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('replaces corrected answers', () => {
    const state = hostGameReducer(playing, { type: 'answerReceived', answer: answer() });
    const judged = hostGameReducer(state, {
      type: 'answerJudged',
      answer: answer({ verdict: { title: true, artist: false }, judgedByHost: true }),
    });
    expect(judged?.answers[0]).toMatchObject({ judgedByHost: true, verdict: { title: true } });
  });

  it('flags that everyone answered, until the reveal', () => {
    const flagged = hostGameReducer(playing, { type: 'allAnswered', songId: 's1' });
    expect(flagged?.everyoneAnswered).toBe(true);
    expect(hostGameReducer(playing, { type: 'allAnswered', songId: 'other' })).toBe(playing);
    expect(hostGameReducer(flagged, { type: 'songRevealed', reveal })?.everyoneAnswered).toBe(
      false,
    );
  });

  it('shows the reveal and its scores', () => {
    const scores = [{ playerId: 'p1', playerName: 'Alice', points: 2 }];
    const state = hostGameReducer(playing, {
      type: 'songRevealed',
      reveal: { ...reveal, scoreboard: scores },
    });
    expect(state).toMatchObject({
      currentSong: { revealed: true },
      reveal: { title: 'One More Time' },
      scoreboard: scores,
    });
    expect(
      hostGameReducer(playing, { type: 'songRevealed', reveal: { ...reveal, songId: 'other' } }),
    ).toBe(playing);
  });

  it('updates scores after a correction and at the end', () => {
    const scores = [{ playerId: 'p1', playerName: 'Alice', points: 5 }];
    const revealed = hostGameReducer(playing, { type: 'songRevealed', reveal });
    const updated = hostGameReducer(revealed, { type: 'scoreboardUpdated', scoreboard: scores });
    expect(updated).toMatchObject({ scoreboard: scores, reveal: { scoreboard: scores } });
    expect(hostGameReducer(updated, { type: 'gameFinished', scoreboard: scores })).toMatchObject({
      status: 'finished',
      hasNextSong: false,
    });
  });

  it('keeps the recap sent when the game ends', () => {
    const finished = hostGameReducer(playing, { type: 'gameFinished', scoreboard: [] });
    const recap = gameRecap();
    expect(finished?.recap).toBeNull();
    expect(hostGameReducer(finished, { type: 'recapReceived', recap })?.recap).toBe(recap);
    // A correction after the end sends an updated recap, which replaces the previous one.
    const corrected = gameRecap({ gameName: 'Updated' });
    const next = hostGameReducer(finished, { type: 'recapReceived', recap });
    expect(hostGameReducer(next, { type: 'recapReceived', recap: corrected })?.recap).toBe(
      corrected,
    );
  });
});
