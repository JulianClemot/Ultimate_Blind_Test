import { describe, expect, it } from 'vitest';

import { PlaylistId } from './PlaylistId';

describe('PlaylistId', () => {
  it.each([
    ['908622995', '908622995'],
    ['  908622995 ', '908622995'],
    ['https://www.deezer.com/playlist/908622995', '908622995'],
    ['https://www.deezer.com/fr/playlist/908622995?utm_source=share', '908622995'],
    ['deezer.com/en/playlist/3155776842/', '3155776842'],
  ])('reads "%s" as playlist %s', (raw, expected) => {
    const result = PlaylistId.parse(raw);
    expect(result.ok && result.value.value).toBe(expected);
  });

  it.each([
    ['https://link.deezer.com/s/34RcmQ2R65XGi5vTkvs5u', true],
    [' https://link.deezer.com/s/34RcmQ2R65XGi5vTkvs5u/ ', true],
    ['http://link.deezer.com/s/abc', false],
    ['https://link.deezer.com.evil.com/s/abc', false],
    ['https://evil.com/?https://link.deezer.com/s/abc', false],
    ['https://www.deezer.com/playlist/42', false],
  ])('recognises share link "%s": %s', (raw, expected) => {
    expect(PlaylistId.isShareLink(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', 'https://www.deezer.com/fr/album/302127', 'https://example.com/x'])(
    'rejects "%s"',
    (raw) => {
      const result = PlaylistId.parse(raw);
      expect(!result.ok && result.error.code).toBe('INVALID_PLAYLIST');
    },
  );
});
