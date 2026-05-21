const { initializeDatabase } = require('./src/db/database');

async function test() {
  const db = await initializeDatabase();
  console.log('Database loaded successfully');
  
  try {
    const email = `debug-${Date.now()}@debug.com`;
    console.log('Inserting with email:', email);
    
    // Let's inspect the wrapper's inner state
    const stmt = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
    console.log('Prepared statement.');
    
    const result = stmt.run('Test Debug', email, 'hash');
    console.log('Wrapper run result:', result);
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    console.log('Fetched user:', user);
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

test().catch(console.error);
