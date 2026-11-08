import type { GameRecapDto, SuperlativeKindDto } from '@ubt/shared';
import { t } from 'i18next';

import { formatDecimal } from './time';

/** Words for the awards of the recap, shared by the screen and the share card. */
export const describeAward = ({ kind, value }: { kind: SuperlativeKindDto; value: number }) => {
  const title = t(`awards.${kind}.title`);
  switch (kind) {
    case 'fastest-finger':
      return {
        icon: '⚡',
        title,
        detail: t('awards.fastest-finger.detail', { seconds: formatDecimal(value / 1000, 1) }),
      };
    case 'sniper':
      return { icon: '🎯', title, detail: t('awards.sniper.detail', { count: value }) };
    case 'stubborn':
      return { icon: '🙈', title, detail: t('awards.stubborn.detail', { count: value }) };
    case 'comeback-kid':
      return { icon: '🚀', title, detail: t('awards.comeback-kid.detail', { count: value }) };
  }
};

export interface ShareCard {
  readonly title: string;
  /** The first three of the ranking, ties sharing a rank. */
  readonly podium: readonly { rank: number; name: string; points: number }[];
  /** One line under the podium: the viewer's award or rank, or the first award of the game. */
  readonly highlight: string | null;
}

const PODIUM_SIZE = 3;

/** What the share image shows, as plain data: easy to test, drawn separately on a canvas. */
export const buildShareCard = (recap: GameRecapDto, playerId?: string): ShareCard => {
  const podium = recap.standings
    .slice(0, PODIUM_SIZE)
    .map(({ rank, playerName, points }) => ({ rank, name: playerName, points }));

  let highlight: string | null = null;
  if (playerId) {
    const mine = recap.superlatives.find((s) => s.playerId === playerId);
    const standing = recap.standings.find((s) => s.playerId === playerId);
    if (mine) {
      const { icon, title, detail } = describeAward(mine);
      highlight = `${icon} ${title} · ${detail}`;
    } else if (standing) {
      highlight = t('share.finishedHighlight', { rank: standing.rank, points: standing.points });
    }
  } else {
    const first = recap.superlatives[0];
    if (first) {
      const { icon, title } = describeAward(first);
      highlight = `${icon} ${title} · ${first.playerName}`;
    }
  }
  return { title: recap.gameName, podium, highlight };
};

// ── Drawing ─────────────────────────────────────────────────────────────────

const WIDTH = 1080;
const HEIGHT = 1350;
const COLORS = { cream: '#f7ecd2', ink: '#241d19', tomato: '#e0553a', mustard: '#e8b930' };
const MEDALS = ['🥇', '🥈', '🥉'];

/** Draws the card (retro-vinyl look) on a canvas and returns it as a PNG. */
export const renderShareCard = (card: ShareCard): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error(t('share.noCanvas')));

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 12;
  ctx.strokeRect(36, 36, WIDTH - 72, HEIGHT - 72);

  // A record in the corner.
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(WIDTH - 170, 190, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.tomato;
  ctx.beginPath();
  ctx.arc(WIDTH - 170, 190, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.arc(WIDTH - 170, 190, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.tomato;
  ctx.font = '700 40px "DM Sans", sans-serif';
  ctx.fillText('ULTIMATE BLIND TEST', 90, 150);
  ctx.fillStyle = COLORS.ink;
  ctx.font = '84px Shrikhand, serif';
  ctx.fillText(fit(ctx, card.title, WIDTH - 480), 90, 270);

  card.podium.forEach(({ rank, name, points }, index) => {
    const y = 470 + index * 190;
    ctx.fillStyle = index === 0 ? COLORS.mustard : '#fffaf0';
    ctx.fillRect(90, y - 100, WIDTH - 180, 150);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 6;
    ctx.strokeRect(90, y - 100, WIDTH - 180, 150);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '70px sans-serif';
    ctx.fillText(MEDALS[rank - 1] ?? `${rank}.`, 120, y + 8);
    ctx.font = '700 64px "DM Sans", sans-serif';
    ctx.fillText(fit(ctx, name, 520), 250, y + 8);
    ctx.textAlign = 'right';
    ctx.fillText(t('common.pts', { value: points }), WIDTH - 120, y + 8);
    ctx.textAlign = 'left';
  });

  if (card.highlight) {
    ctx.fillStyle = COLORS.tomato;
    ctx.font = '700 52px "DM Sans", sans-serif';
    ctx.fillText(fit(ctx, card.highlight, WIDTH - 180), 90, 1130);
  }
  ctx.fillStyle = COLORS.ink;
  ctx.font = '500 34px "DM Sans", sans-serif';
  ctx.fillText(t('share.cta'), 90, 1230);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(t('share.noImage')))),
      'image/png',
    ),
  );
};

/** Shortens `text` with an ellipsis until it fits `maxWidth` with the current font. */
const fit = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && ctx.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
};

// ── Sharing ─────────────────────────────────────────────────────────────────

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface ShareDeps {
  readonly nav: Navigator;
  readonly download: (blob: Blob, filename: string) => void;
}

const FILENAME = 'blind-test.png';

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/** Shares the image with the system share sheet, or downloads it when files cannot be shared. */
export const shareImage = async (
  image: Blob,
  title: string,
  { nav, download }: ShareDeps = { nav: navigator, download: downloadBlob },
): Promise<ShareOutcome> => {
  const file = new File([image], FILENAME, { type: 'image/png' });
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: t('share.text', { title }) });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  download(image, FILENAME);
  return 'downloaded';
};
