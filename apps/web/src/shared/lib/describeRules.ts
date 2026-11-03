import type { RoundRulesDto } from '@ubt/shared';

/** The preview Deezer provides is 30 s long: playing all of it is not worth mentioning. */
const FULL_PREVIEW_SEC = 30;

const points = (count: number) => `${count} point${count === 1 ? '' : 's'}`;

/** Rules of a round as short sentences players can read in the lobby. */
export const describeRules = (rules: RoundRulesDto): string[] => {
  const asksTitle = rules.titlePoints > 0;
  const asksArtist = rules.artistPoints > 0;
  const lines = [
    `${rules.songCount} song${rules.songCount === 1 ? '' : 's'}, ${rules.answerTimeSec} s to answer each`,
  ];

  if (asksTitle && asksArtist) {
    lines.push(
      `Find the title (${points(rules.titlePoints)}) and the artist (${points(rules.artistPoints)})`,
    );
  } else if (asksTitle) {
    lines.push(`Find the title (${points(rules.titlePoints)})`);
  } else if (asksArtist) {
    lines.push(`Find the artist (${points(rules.artistPoints)})`);
  }

  lines.push(
    rules.scoring === 'first'
      ? 'Only the fastest correct answer scores'
      : 'Everyone who answers correctly scores',
  );
  if (asksTitle && asksArtist && rules.bothBonus > 0) {
    lines.push(`Bonus: +${points(rules.bothBonus)} for finding both`);
  }
  if (rules.speedBonus > 0) {
    lines.push(`Speed bonus: up to +${points(rules.speedBonus)} for quick answers`);
  }
  if (rules.excerptSec < FULL_PREVIEW_SEC) {
    lines.push(`Only the first ${rules.excerptSec} s of each song are played`);
  }
  if (rules.playbackRate !== 1) {
    lines.push(`Songs are played at ×${rules.playbackRate} speed`);
  }
  return lines;
};
