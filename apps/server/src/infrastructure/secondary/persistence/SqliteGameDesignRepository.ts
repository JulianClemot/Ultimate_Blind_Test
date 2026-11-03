import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { GameDesignRepository } from '../../../application';
import { GameDesign, type GameDesignSnapshot } from '../../../domain';

/**
 * Stores each design as a JSON document in SQLite (Node's built-in driver, no native
 * dependency). Designs are small, edited as a whole and never queried by content.
 */
export class SqliteGameDesignRepository implements GameDesignRepository {
  private readonly db: DatabaseSync;

  /** `path` may be ':memory:' (tests). Parent directories are created. */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS game_designs (
        id         TEXT PRIMARY KEY,
        document   TEXT NOT NULL,
        updated_at REAL NOT NULL
      ) STRICT;
    `);
  }

  save(design: GameDesign): Promise<void> {
    const snapshot = design.toSnapshot();
    this.db
      .prepare(
        `INSERT INTO game_designs (id, document, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`,
      )
      .run(snapshot.id, JSON.stringify(snapshot), snapshot.updatedAt);
    return Promise.resolve();
  }

  findById(id: string): Promise<GameDesign | undefined> {
    const row = this.db.prepare('SELECT document FROM game_designs WHERE id = ?').get(id) as
      { document: string } | undefined;
    return Promise.resolve(
      row ? GameDesign.restore(JSON.parse(row.document) as GameDesignSnapshot) : undefined,
    );
  }

  delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM game_designs WHERE id = ?').run(id);
    return Promise.resolve();
  }

  close(): void {
    this.db.close();
  }
}
