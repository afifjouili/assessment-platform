const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

function seedDatabase() {
  const db = getDb();

  // Check if admin user already exists
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@platform.tn');

  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (name, email, password_hash, role, organization) VALUES (?, ?, ?, ?, ?)'
    ).run('Admin', 'admin@platform.tn', passwordHash, 'admin', 'Platform Administration');

    console.log('Default admin user created: admin@platform.tn / admin123');
  } else {
    console.log('Admin user already exists, skipping seed');
  }
}

module.exports = { seedDatabase };
