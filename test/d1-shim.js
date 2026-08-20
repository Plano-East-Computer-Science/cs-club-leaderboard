/**
 * A minimal D1-compatible wrapper around Node's built-in SQLite.
 *
 * D1 is SQLite, so the real queries in worker/db.js run against this unchanged.
 * That means the tests exercise the actual SQL the site uses -- the points sum,
 * the tie-ranking, the backup round trip -- without needing Cloudflare running.
 *
 * Only the surface worker/db.js touches is implemented: prepare/bind/all/first/
 * run and batch.
 */
import { DatabaseSync } from 'node:sqlite';

class Stmt {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new Stmt(this.db, this.sql, params);
  }

  async all() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    // node:sqlite returns null-prototype objects; spread them so deepEqual and
    // property access behave like ordinary objects, as they do on D1.
    return { success: true, results: rows.map((r) => ({ ...r })) };
  }

  async first() {
    const row = this.db.prepare(this.sql).get(...this.params);
    return row ? { ...row } : null;
  }

  async run() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes },
    };
  }
}

class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  prepare(sql) {
    return new Stmt(this.db, sql);
  }

  exec(sql) {
    this.db.exec(sql);
  }

  /** D1 runs a batch as one atomic transaction; so does this. */
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function makeTestDb(schemaSql) {
  const d1 = new FakeD1();
  d1.exec(schemaSql);
  return d1;
}
