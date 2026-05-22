import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

// On Vercel: /tmp is writable. Locally: use backend/data for compatibility.
const dbPath = process.env.VERCEL
  ? '/tmp/assessment.db'
  : path.join(process.cwd(), '..', 'backend', 'data', 'assessment.db');

class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
    this.transactionDepth = 0;
  }

  prepare(sql) {
    const self = this;
    return {
      get(...params) {
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) return stmt.getAsObject();
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const results = [];
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params);
          while (stmt.step()) results.push(stmt.getAsObject());
          return results;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        self.sqlDb.run(sql, params);
        const lastId = self.sqlDb.exec('SELECT last_insert_rowid()');
        const lastInsertRowid = lastId.length > 0 ? lastId[0].values[0][0] : 0;
        const changes = self.sqlDb.getRowsModified();
        if (self.transactionDepth === 0) self._save();
        return { lastInsertRowid, changes };
      }
    };
  }

  exec(sql) {
    this.sqlDb.exec(sql);
    if (this.transactionDepth === 0) this._save();
  }

  pragma(pragma) {
    try { this.sqlDb.exec(`PRAGMA ${pragma}`); } catch (e) { /* silently skip */ }
  }

  transaction(fn) {
    const self = this;
    return function(...args) {
      self.transactionDepth++;
      if (self.transactionDepth === 1) self.sqlDb.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self.transactionDepth--;
        if (self.transactionDepth === 0) {
          self.sqlDb.exec('COMMIT');
          self._save();
        }
        return result;
      } catch (err) {
        self.transactionDepth--;
        if (self.transactionDepth === 0) {
          try { self.sqlDb.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        }
        throw err;
      }
    };
  }

  _save() {
    try {
      const data = this.sqlDb.export();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (e) {
      console.warn('DB save warning:', e.message);
    }
  }
}

// Singleton
let db = null;
let initPromise = null;

export async function initializeDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let wasmBinary;
    if (process.env.VERCEL) {
      // On Vercel, fetch the WASM binary from the public directory via the deployment URL
      const host = process.env.VERCEL_URL || 'conformity-by-iwatch.vercel.app';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const response = await fetch(`${protocol}://${host}/sql-wasm.wasm`);
      if (!response.ok) throw new Error(`Failed to fetch WASM: ${response.statusText}`);
      wasmBinary = Buffer.from(await response.arrayBuffer());
    } else {
      // Locally, read directly from node_modules
      const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      wasmBinary = fs.readFileSync(wasmPath);
    }
    
    const SQL = await initSqlJs({ wasmBinary });
    let sqlDb;

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
    } else {
      sqlDb = new SQL.Database();
    }

    db = new DatabaseWrapper(sqlDb);
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        organization TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        association_name TEXT NOT NULL,
        user_id INTEGER,
        status TEXT DEFAULT 'in_progress',
        total_score INTEGER DEFAULT 0,
        max_score INTEGER DEFAULT 0,
        percentage INTEGER DEFAULT 0,
        level TEXT DEFAULT '',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        axis_id INTEGER NOT NULL,
        question_index INTEGER NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        UNIQUE(assessment_id, axis_id, question_index)
      );
    `);

    // Seed admin user
    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@platform.tn');
    if (!existingAdmin) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      db.prepare('INSERT INTO users (name, email, password_hash, role, organization) VALUES (?, ?, ?, ?, ?)')
        .run('Admin', 'admin@platform.tn', passwordHash, 'admin', 'Platform Administration');
    }

    return db;
  })();

  return initPromise;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

export async function getDbReady() {
  await initializeDatabase();
  return getDb();
}
