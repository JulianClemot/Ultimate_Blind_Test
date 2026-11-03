import type { RoundRulesDto } from '@ubt/shared';

/** The preview Deezer provides is 30 s long: playing all of it is not worth mentioning. */
const FULL_PREVIEW_SEC = 30;

/** Longest list of points by place worth showing in one line. */
const MAX_PLACES_LISTED = 6;

/** Points of a part for the first places, e.g. 3 points losing 1 per place → [3, 2, 1]. */
const pointsByPlace = (base: number, rules: RoundRulesDto): string => {
  const places = Math.min(rules.winnerCount, MAX_PLACES_LISTED);
  const list = Array.from({ length: places }, (_, place) =>
    Math.max(0, base - place * rules.rankStep),
  ).join(', ');
  return rules.winnerCount > MAX_PLACES_LISTED ? `${list}, …` : list;
};

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

  if (rules.scoring === 'everyone') {
    lines.push('Everyone who answers correctly scores');
  } else if (rules.winnerCount === 1) {
    lines.push('Only the fastest correct answer scores');
  } else {
    lines.push(`The first ${rules.winnerCount} players to answer correctly score`);
  }
  if (rules.scoring === 'first' && rules.winnerCount > 1 && rules.rankStep > 0) {
    lines.push(
      asksTitle && asksArtist
        ? `Points by place — title: ${pointsByPlace(rules.titlePoints, rules)} · artist: ${pointsByPlace(rules.artistPoints, rules)}`
        : `Points by place: ${pointsByPlace(asksTitle ? rules.titlePoints : rules.artistPoints, rules)}`,
    );
  }
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
