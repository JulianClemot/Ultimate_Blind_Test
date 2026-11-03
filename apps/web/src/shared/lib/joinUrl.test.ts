import { describe, expect, it } from 'vitest';

import { buildJoinUrl } from './joinUrl';

describe('buildJoinUrl', () => {
  it('swaps localhost for the LAN address, keeping the port', () => {
    expect(buildJoinUrl('ABCD', new URL('http://localhost:5173/host/g1'), '192.168.1.42')).toBe(
      'http://192.168.1.42:5173/?code=ABCD',
    );
  });

  it('keeps a hostname that is already reachable', () => {
    expect(buildJoinUrl('ABCD', new URL('https://blind.example.com/host/g1'), '10.0.0.2')).toBe(
      'https://blind.example.com/?code=ABCD',
    );
  });

  it('falls back to the current host when no LAN address is known', () => {
    expect(buildJoinUrl('ABCD', new URL('http://localhost:5173/host/g1'))).toBe(
      'http://localhost:5173/?code=ABCD',
    );
  });
});
