import { describe, expect, it, vi } from 'vitest';

import { gameRecap } from '@/test/fixtures';

import { buildShareCard, describeAward, shareImage } from './shareCard';

describe('describeAward', () => {
  it('words each award with its value', () => {
    expect(describeAward({ kind: 'fastest-finger', value: 2_345 })).toEqual({
      icon: '⚡',
      title: 'Fastest finger',
      detail: '2.3 s on average',
    });
    expect(describeAward({ kind: 'sniper', value: 1 }).detail).toBe('first to find 1 song');
    expect(describeAward({ kind: 'sniper', value: 3 }).detail).toBe('first to find 3 songs');
    expect(describeAward({ kind: 'stubborn', value: 4 }).detail).toBe('4 wrong guesses');
    expect(describeAward({ kind: 'comeback-kid', value: 2 }).detail).toBe('climbed 2 places');
  });
});

describe('buildShareCard', () => {
  it('shows the top three, with ties sharing a rank', () => {
    const card = buildShareCard(gameRecap());

    expect(card.title).toBe('Friday night');
    expect(card.podium).toEqual([
      { rank: 1, name: 'Alice', points: 5 },
      { rank: 2, name: 'Bob', points: 3 },
      { rank: 2, name: 'Chloé', points: 3 },
    ]);
  });

  it("highlights the viewing player's own award", () => {
    const card = buildShareCard(gameRecap(), 'p2');

    expect(card.highlight).toBe('🙈 Stubborn · 4 wrong guesses');
  });

  it('falls back to the final rank when the player has no award', () => {
    const recap = gameRecap({ superlatives: [] });

    expect(buildShareCard(recap, 'p2').highlight).toBe('Finished #2 with 3 pts');
    expect(buildShareCard(recap, 'p1').highlight).toBe('Finished #1 with 5 pts');
  });

  it("highlights the winner's best award when nobody in particular is viewing", () => {
    const card = buildShareCard(gameRecap());

    expect(card.highlight).toBe('⚡ Fastest finger · Alice');
  });

  it('has no highlight without awards or a viewing player', () => {
    expect(buildShareCard(gameRecap({ superlatives: [] })).highlight).toBeNull();
  });
});

describe('shareImage', () => {
  const blob = new Blob(['png'], { type: 'image/png' });

  it('opens the system share sheet when the browser can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const download = vi.fn();
    const nav = { canShare: () => true, share } as unknown as Navigator;

    const outcome = await shareImage(blob, 'Friday night', { nav, download });

    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Friday night',
        files: [expect.objectContaining({ name: 'blind-test.png', type: 'image/png' }) as unknown],
      }),
    );
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads the image when files cannot be shared', async () => {
    const download = vi.fn();

    const outcome = await shareImage(blob, 'Friday night', { nav: {} as Navigator, download });

    expect(outcome).toBe('downloaded');
    expect(download).toHaveBeenCalledWith(blob, 'blind-test.png');
  });

  it('reports a dismissed share sheet instead of failing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    const nav = { canShare: () => true, share } as unknown as Navigator;

    expect(await shareImage(blob, 'x', { nav, download: vi.fn() })).toBe('cancelled');
  });

  it('lets real sharing errors through', async () => {
    const share = vi.fn().mockRejectedValue(new Error('boom'));
    const nav = { canShare: () => true, share } as unknown as Navigator;

    await expect(shareImage(blob, 'x', { nav, download: vi.fn() })).rejects.toThrow('boom');
  });
});
