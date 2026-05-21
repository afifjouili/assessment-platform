const initSqlJs = require('sql.js');

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `);

  console.log('Inserting user...');
  db.run('INSERT INTO users (name) VALUES (?)', ['Test Name']);
  
  console.log('getRowsModified immediately after insert:', db.getRowsModified());
  
  const lastId = db.exec("SELECT last_insert_rowid()");
  console.log('lastId exec output:', JSON.stringify(lastId));
  
  console.log('getRowsModified after select last_insert_rowid:', db.getRowsModified());
}

test().catch(console.error);
