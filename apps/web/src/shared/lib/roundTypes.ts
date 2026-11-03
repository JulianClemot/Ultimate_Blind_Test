import type { RoundTypeDto } from '@ubt/shared';

export const ROUND_TYPES: readonly RoundTypeDto[] = [
  'classic',
  'everyone',
  'flash',
  'fast-forward',
];

export const ROUND_TYPE_INFO: Readonly<
  Record<RoundTypeDto, { label: string; description: string }>
> = {
  classic: {
    label: 'Classic',
    description: 'Title and artist score separately; the fastest correct answer takes the points.',
  },
  everyone: {
    label: 'Everyone scores',
    description: 'Every correct answer scores, and faster answers earn more.',
  },
  flash: {
    label: 'Flash',
    description: 'Only a few seconds of the song are played.',
  },
  'fast-forward': {
    label: 'Fast-forward',
    description: 'The song plays faster than normal.',
  },
};
