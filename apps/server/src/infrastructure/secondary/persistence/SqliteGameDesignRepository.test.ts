import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { GameDesign, PlaylistId, RoundRules } from '../../../domain';
import { SqliteGameDesignRepository } from './SqliteGameDesignRepository';

const design = () => {
  const created = GameDesign.create({ id: 'd1', editToken: 'secret', name: 'Party', createdAt: 1 });
  const playlist = PlaylistId.parse('42');
  if (!created.ok || !playlist.ok) throw new Error('fixture');
  created.value.update({
    name: 'Party',
    rounds: [
      {
        name: 'Speed round',
        type: 'flash',
        playlist: playlist.value,
        playlistTitle: '80s',
        rules: RoundRules.preset('flash'),
        sourceOverrides: { '1': 'Frozen', '2': null },
      },
    ],
    updatedAt: 2,
  });
  return created.value;
};

describe('SqliteGameDesignRepository', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  it('stores, updates and deletes designs', async () => {
    const repository = new SqliteGameDesignRepository(':memory:');
    const original = design();
    await repository.save(original);
    expect((await repository.findById('d1'))?.toSnapshot()).toEqual(original.toSnapshot());

    original.update({ name: 'Renamed', rounds: [], updatedAt: 3 });
    await repository.save(original);
    expect((await repository.findById('d1'))?.name).toBe('Renamed');

    await repository.delete('d1');
    expect(await repository.findById('d1')).toBeUndefined();
    repository.close();
  });

  it('keeps designs across restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ubt-'));
    dirs.push(dir);
    const path = join(dir, 'nested', 'ubt.sqlite');

    const first = new SqliteGameDesignRepository(path);
    await first.save(design());
    first.close();

    const second = new SqliteGameDesignRepository(path);
    expect((await second.findById('d1'))?.rounds[0]).toMatchObject({
      name: 'Speed round',
      playlistTitle: '80s',
    });
    second.close();
  });
});
