import { describe, expect, it } from 'vitest';

import { PlaylistId } from '../music/PlaylistId';
import { GameDesign } from './GameDesign';
import type { RoundPlan } from './RoundPlan';
import { RoundRules } from './RoundRules';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }) => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const plan = (playlist: string, type: RoundPlan['type'] = 'classic'): RoundPlan => ({
  type,
  playlist: unwrap(PlaylistId.parse(playlist)),
  name: `Round ${playlist}`,
  playlistTitle: `Playlist ${playlist}`,
  rules: RoundRules.preset(type),
});

const newDesign = (name = '  Friday   night ') =>
  GameDesign.create({ id: 'd1', editToken: 'secret', name, createdAt: 1_000 });

describe('GameDesign', () => {
  it('starts empty with a normalized name', () => {
    const design = unwrap(newDesign());
    expect(design.name).toBe('Friday night');
    expect(design.rounds).toEqual([]);
  });

  it.each(['', '   ', 'x'.repeat(GameDesign.MAX_NAME_LENGTH + 1)])(
    'rejects the name "%s"',
    (name) => {
      const result = newDesign(name);
      expect(!result.ok && result.error.code).toBe('INVALID_DESIGN_NAME');
    },
  );

  it('is editable with its token only', () => {
    const design = unwrap(newDesign());
    expect(design.canEdit('secret')).toBe(true);
    expect(design.canEdit('guess')).toBe(false);
  });

  it('replaces its rounds on update', () => {
    const design = unwrap(newDesign());
    unwrap(
      design.update({ name: 'Party', rounds: [plan('1'), plan('2', 'flash')], updatedAt: 2_000 }),
    );
    expect(design.rounds.map((r) => [r.type, r.playlist.value])).toEqual([
      ['classic', '1'],
      ['flash', '2'],
    ]);
    expect(design.updatedAt).toBe(2_000);
  });

  it('limits the number of rounds', () => {
    const design = unwrap(newDesign());
    const rounds = Array.from({ length: GameDesign.MAX_ROUNDS + 1 }, (_, i) => plan(String(i + 1)));
    const result = design.update({ name: 'Too long', rounds, updatedAt: 2_000 });
    expect(!result.ok && result.error.code).toBe('TOO_MANY_ROUNDS');
    expect(design.name).toBe('Friday night');
  });

  it('restores designs saved before winners and rank steps existed', () => {
    const design = unwrap(newDesign());
    unwrap(design.update({ name: 'Party', rounds: [plan('42')], updatedAt: 2_000 }));
    const snapshot = structuredClone(design.toSnapshot());
    const legacyRound = { ...snapshot.rounds[0]!, rules: { ...snapshot.rounds[0]!.rules } };
    delete legacyRound.rules.winnerCount;
    delete legacyRound.rules.rankStep;
    const legacy = { ...snapshot, rounds: [legacyRound] };

    const restored = GameDesign.restore(legacy).rounds[0]?.rules;
    expect([restored?.winnerCount, restored?.rankStep]).toEqual([1, 0]);
  });

  it('restores designs saved before team mode existed, with team mode off', () => {
    const design = unwrap(newDesign());
    unwrap(design.update({ name: 'Party', rounds: [plan('42')], updatedAt: 2_000 }));
    const snapshot = structuredClone(design.toSnapshot());
    const legacyRound = { ...snapshot.rounds[0]!, rules: { ...snapshot.rounds[0]!.rules } };
    delete legacyRound.rules.teamMode;

    const restored = GameDesign.restore({ ...snapshot, rounds: [legacyRound] });
    expect(restored.rounds[0]?.rules.teamMode).toBe(false);
  });

  it('survives a snapshot round trip', () => {
    const design = unwrap(newDesign());
    unwrap(design.update({ name: 'Party', rounds: [plan('42', 'everyone')], updatedAt: 2_000 }));
    const restored = GameDesign.restore(structuredClone(design.toSnapshot()));
    expect(restored.toSnapshot()).toEqual(design.toSnapshot());
    expect(restored.canEdit('secret')).toBe(true);
  });
});
