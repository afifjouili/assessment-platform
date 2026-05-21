const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { calculateScores, calculateAxisScores, AXES } = require('../services/scoring');

const router = express.Router();

// GET /api/assessments — List user's assessments
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const assessments = db.prepare(
      'SELECT * FROM assessments WHERE user_id = ? ORDER BY started_at DESC'
    ).all(req.user.id);

    res.json({ assessments });
  } catch (err) {
    console.error('List assessments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/assessments — Create new assessment
router.post('/', optionalAuthenticate, (req, res) => {
  try {
    const { associationName } = req.body;
    const db = getDb();

    if (!associationName) {
      return res.status(400).json({ error: 'Association name is required.' });
    }

    const userId = req.user ? req.user.id : null;

    const result = db.prepare(
      'INSERT INTO assessments (association_name, user_id) VALUES (?, ?)'
    ).run(associationName, userId);

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ assessment });
  } catch (err) {
    console.error('Create assessment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/assessments/:id — Get assessment with all answers
router.get('/:id', optionalAuthenticate, (req, res) => {
  try {
    const db = getDb();
    let assessment;
    if (req.user && req.user.role === 'admin') {
      assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
    } else if (req.user) {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
      ).get(req.params.id, req.user.id);
    } else {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND user_id IS NULL'
      ).get(req.params.id);
    }

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    const answers = db.prepare(
      'SELECT * FROM answers WHERE assessment_id = ? ORDER BY axis_id, question_index'
    ).all(assessment.id);

    const axisScores = calculateAxisScores(answers);

    res.json({ assessment, answers, axisScores });
  } catch (err) {
    console.error('Get assessment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/assessments/:id/answers — Save answers
router.put('/:id/answers', optionalAuthenticate, (req, res) => {
  try {
    const db = getDb();
    let assessment;
    if (req.user) {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
      ).get(req.params.id, req.user.id);
    } else {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND user_id IS NULL'
      ).get(req.params.id);
    }

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    if (assessment.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify a completed assessment.' });
    }

    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array is required.' });
    }

    // Validate each answer
    for (const answer of answers) {
      if (answer.axisId == null || answer.questionIndex == null || answer.score == null) {
        return res.status(400).json({ error: 'Each answer must have axisId, questionIndex, and score.' });
      }

      if (![0, 1, 2].includes(answer.score)) {
        return res.status(400).json({ error: 'Score must be 0, 1, or 2.' });
      }

      // Validate axisId exists
      const axis = AXES.find(a => a.id === answer.axisId);
      if (!axis) {
        return res.status(400).json({ error: `Invalid axisId: ${answer.axisId}` });
      }

      // Validate questionIndex is within range
      if (answer.questionIndex < 0 || answer.questionIndex >= axis.questions.length) {
        return res.status(400).json({ error: `Invalid questionIndex ${answer.questionIndex} for axis ${answer.axisId}` });
      }
    }

    // Upsert answers using INSERT OR REPLACE
    const saveAll = db.transaction((answerList) => {
      for (const answer of answerList) {
        db.prepare(`
          INSERT INTO answers (assessment_id, axis_id, question_index, score)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(assessment_id, axis_id, question_index)
          DO UPDATE SET score = excluded.score, created_at = CURRENT_TIMESTAMP
        `).run(assessment.id, answer.axisId, answer.questionIndex, answer.score);
      }
    });

    saveAll(answers);

    // Return updated answers
    const updatedAnswers = db.prepare(
      'SELECT * FROM answers WHERE assessment_id = ? ORDER BY axis_id, question_index'
    ).all(assessment.id);

    res.json({ message: 'Answers saved successfully.', answers: updatedAnswers });
  } catch (err) {
    console.error('Save answers error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/assessments/:id/complete — Calculate scores and mark complete
router.post('/:id/complete', optionalAuthenticate, (req, res) => {
  try {
    const db = getDb();
    let assessment;
    if (req.user) {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
      ).get(req.params.id, req.user.id);
    } else {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND user_id IS NULL'
      ).get(req.params.id);
    }

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    if (assessment.status === 'completed') {
      return res.status(400).json({ error: 'Assessment is already completed.' });
    }

    // Get all answers
    const answers = db.prepare(
      'SELECT * FROM answers WHERE assessment_id = ?'
    ).all(assessment.id);

    // Calculate scores
    const { totalScore, maxScore, percentage, level } = calculateScores(answers);
    const axisScores = calculateAxisScores(answers);

    // Update assessment
    db.prepare(`
      UPDATE assessments
      SET status = 'completed', total_score = ?, max_score = ?, percentage = ?, level = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totalScore, maxScore, percentage, level, assessment.id);

    const updatedAssessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessment.id);

    res.json({
      assessment: updatedAssessment,
      axisScores,
      answers
    });
  } catch (err) {
    console.error('Complete assessment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/assessments/:id — Delete assessment
router.delete('/:id', optionalAuthenticate, (req, res) => {
  try {
    const db = getDb();
    let assessment;
    if (req.user && req.user.role === 'admin') {
      assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
    } else if (req.user) {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
      ).get(req.params.id, req.user.id);
    } else {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND user_id IS NULL'
      ).get(req.params.id);
    }

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    // Delete answers first (since CASCADE may not work in sql.js)
    db.prepare('DELETE FROM answers WHERE assessment_id = ?').run(assessment.id);
    db.prepare('DELETE FROM assessments WHERE id = ?').run(assessment.id);

    res.json({ message: 'Assessment deleted successfully.' });
  } catch (err) {
    console.error('Delete assessment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
