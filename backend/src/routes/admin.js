const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/stats — Dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalAssessments = db.prepare('SELECT COUNT(*) as count FROM assessments').get().count;

    const avgScoreRow = db.prepare(
      "SELECT AVG(percentage) as avg FROM assessments WHERE status = 'completed'"
    ).get();
    const avgScore = avgScoreRow && avgScoreRow.avg ? Math.round(avgScoreRow.avg) : 0;

    const recentAssessments = db.prepare(`
      SELECT a.*, COALESCE(u.name, 'زائر (غير مسجل)') as user_name, COALESCE(u.email, '-') as user_email
      FROM assessments a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.started_at DESC
      LIMIT 10
    `).all();

    res.json({ totalUsers, totalAssessments, avgScore, recentAssessments });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/users — List all users
router.get('/users', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(
      'SELECT id, name, email, role, organization, created_at FROM users ORDER BY created_at DESC'
    ).all();

    res.json({ users });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/assessments — List all assessments
router.get('/assessments', (req, res) => {
  try {
    const db = getDb();
    const assessments = db.prepare(`
      SELECT a.*, COALESCE(u.name, 'زائر (غير مسجل)') as user_name, COALESCE(u.email, '-') as user_email
      FROM assessments a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.started_at DESC
    `).all();

    res.json({ assessments });
  } catch (err) {
    console.error('Admin list assessments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/users/:id — Delete user
router.delete('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.id, 10);

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Delete user's answers, assessments, then user (manual cascade)
    const userAssessments = db.prepare('SELECT id FROM assessments WHERE user_id = ?').all(userId);
    for (const a of userAssessments) {
      db.prepare('DELETE FROM answers WHERE assessment_id = ?').run(a.id);
    }
    db.prepare('DELETE FROM assessments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
