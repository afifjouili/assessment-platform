const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'assessment.db');

/**
 * Wrapper around sql.js that provides a better-sqlite3 compatible API.
 * This allows all route files to use the same db.prepare().get/all/run pattern.
 */
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
          if (stmt.step()) {
            return stmt.getAsObject();
          }
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
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        self.sqlDb.run(sql, params);
        const lastId = self.sqlDb.exec("SELECT last_insert_rowid()");
        const lastInsertRowid = lastId.length > 0 ? lastId[0].values[0][0] : 0;
        const changes = self.sqlDb.getRowsModified();
        if (self.transactionDepth === 0) {
          self._save();
        }
        return {
          lastInsertRowid,
          changes
        };
      }
    };
  }

  exec(sql) {
    this.sqlDb.exec(sql);
    if (this.transactionDepth === 0) {
      this._save();
    }
  }

  pragma(pragma) {
    try {
      this.sqlDb.exec(`PRAGMA ${pragma}`);
    } catch (e) {
      // Some pragmas may not be supported in sql.js, silently skip
    }
  }

  transaction(fn) {
    const self = this;
    return function(...args) {
      self.transactionDepth++;
      if (self.transactionDepth === 1) {
        self.sqlDb.exec('BEGIN TRANSACTION');
      }
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
          try {
            self.sqlDb.exec('ROLLBACK');
          } catch (rollbackErr) {
            console.warn('Rollback failed:', rollbackErr.message);
          }
        }
        throw err;
      }
    };
  }

  _save() {
    const data = this.sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Shared state
let db = null;
let initPromise = null;

/**
 * Initialize the database asynchronously.
 * Returns a promise that resolves to the DatabaseWrapper.
 */
function initializeDatabase() {
  if (initPromise) return initPromise;

  initPromise = initSqlJs().then(SQL => {
    let sqlDb;

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
    } else {
      sqlDb = new SQL.Database();
    }

    db = new DatabaseWrapper(sqlDb);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables
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

    console.log('Database initialized successfully');
    return db;
  });

  return initPromise;
}

/**
 * Get the database instance (must be called after initializeDatabase resolves).
 */
function getDb() {
  if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
  return db;
}

module.exports = { initializeDatabase, getDb };
