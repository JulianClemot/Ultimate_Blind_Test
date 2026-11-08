import type { RoundTypeDto } from '@ubt/shared';
import { t } from 'i18next';

export const ROUND_TYPES: readonly RoundTypeDto[] = [
  'classic',
  'everyone',
  'flash',
  'fast-forward',
];

/** Translated name and description of a round type (call it while rendering). */
export const roundTypeInfo = (type: RoundTypeDto): { label: string; description: string } => ({
  label: t(`roundTypes.${type}.label`),
  description: t(`roundTypes.${type}.description`),
});
