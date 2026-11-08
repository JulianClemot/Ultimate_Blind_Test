import type { RoundRulesDto } from '@ubt/shared';
import { t } from 'i18next';

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

const points = (count: number) => t('rules.points', { count });

/** Rules of a round as short sentences players can read in the lobby. */
export const describeRules = (rules: RoundRulesDto): string[] => {
  const asksTitle = rules.titlePoints > 0;
  const asksArtist = rules.artistPoints > 0;
  const lines = [t('rules.songsAndTime', { count: rules.songCount, time: rules.answerTimeSec })];

  if (asksTitle && asksArtist) {
    lines.push(
      t('rules.findBoth', { title: points(rules.titlePoints), artist: points(rules.artistPoints) }),
    );
  } else if (asksTitle) {
    lines.push(t('rules.findTitle', { title: points(rules.titlePoints) }));
  } else if (asksArtist) {
    lines.push(t('rules.findArtist', { artist: points(rules.artistPoints) }));
  }

  if (rules.scoring === 'everyone') {
    lines.push(t('rules.everyoneScores'));
  } else if (rules.winnerCount === 1) {
    lines.push(t('rules.onlyFastest'));
  } else {
    lines.push(t('rules.firstN', { count: rules.winnerCount }));
  }
  if (rules.scoring === 'first' && rules.winnerCount > 1 && rules.rankStep > 0) {
    lines.push(
      asksTitle && asksArtist
        ? t('rules.placesBoth', {
            title: pointsByPlace(rules.titlePoints, rules),
            artist: pointsByPlace(rules.artistPoints, rules),
          })
        : t('rules.placesOne', {
            list: pointsByPlace(asksTitle ? rules.titlePoints : rules.artistPoints, rules),
          }),
    );
  }
  if (rules.teamMode) {
    lines.push(t('rules.teamRound'));
  }
  if (rules.easyMode) {
    lines.push(t('rules.easyMode'));
  }
  if (asksTitle && asksArtist && rules.bothBonus > 0) {
    lines.push(t('rules.bothBonus', { points: points(rules.bothBonus) }));
  }
  if (rules.speedBonus > 0) {
    lines.push(t('rules.speedBonus', { points: points(rules.speedBonus) }));
  }
  if (rules.excerptSec < FULL_PREVIEW_SEC) {
    lines.push(t('rules.excerpt', { count: rules.excerptSec }));
  }
  if (rules.playbackRate !== 1) {
    lines.push(t('rules.playbackRate', { rate: rules.playbackRate }));
  }
  return lines;
};
