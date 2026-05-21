const initSqlJs = require('sql.js');
const fs = require('fs');

async function test() {
  const SQL = await initSqlJs();
  const sqlDb = new SQL.Database();
  
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  console.log('Database initialized');

  // Let's mimic run() inside DatabaseWrapper
  const sql = 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)';
  const params = ['Test Debug', `debug-${Date.now()}@debug.com`, 'hash'];

  try {
    console.log('Calling sqlDb.run with params:', params);
    sqlDb.run(sql, params);
    console.log('run() executed successfully');
  } catch (err) {
    console.error('run() threw an error:', err);
  }

  console.log('getRowsModified:', sqlDb.getRowsModified());
  const lastId = sqlDb.exec("SELECT last_insert_rowid()");
  console.log('lastId:', JSON.stringify(lastId));
}

test().catch(console.error);
