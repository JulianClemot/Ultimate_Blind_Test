import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_GAME_TTL_MS, useRecentGamesStore } from './recentGamesStore';

const game = (gameId: string) => ({
  gameId,
  playerId: `p-${gameId}`,
  playerName: 'Alice',
  gameName: `Game ${gameId}`,
  code: 'ABCDEF',
});

const ids = () => useRecentGamesStore.getState().games.map((g) => g.gameId);

describe('recent games store', () => {
  beforeEach(() => useRecentGamesStore.setState({ games: [] }));

  it('puts the latest game first and does not duplicate a game joined again', () => {
    const { remember } = useRecentGamesStore.getState();
    remember(game('g1'));
    remember(game('g2'));
    remember(game('g1'));
    expect(ids()).toEqual(['g1', 'g2']);
  });

  it('keeps only the three most recent games', () => {
    const { remember } = useRecentGamesStore.getState();
    ['g1', 'g2', 'g3', 'g4'].forEach((id) => remember(game(id)));
    expect(ids()).toEqual(['g4', 'g3', 'g2']);
  });

  it('drops games older than a day when remembering a new one', () => {
    const { remember } = useRecentGamesStore.getState();
    remember(game('old'), 1_000);
    remember(game('new'), 1_000 + RECENT_GAME_TTL_MS);
    expect(ids()).toEqual(['new']);
  });

  it('forgets a game', () => {
    const { remember, forget } = useRecentGamesStore.getState();
    remember(game('g1'));
    forget('g1');
    expect(ids()).toEqual([]);
  });
});
