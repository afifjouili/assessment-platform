import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { optionalAuthenticate } from '@/lib/auth-helpers';
import { calculateScores, calculateAxisScores } from '@/lib/scoring';

// POST /api/assessments/[id]/complete
export async function POST(request, { params }) {
  try {
    const user = await optionalAuthenticate(request);
    const db = await getDbReady();
    const { id } = params;

    let assessment;
    if (user) {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
      ).get(id, user.id);
    } else {
      assessment = db.prepare(
        'SELECT * FROM assessments WHERE id = ? AND user_id IS NULL'
      ).get(id);
    }

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    if (assessment.status === 'completed') {
      return NextResponse.json({ error: 'Assessment is already completed.' }, { status: 400 });
    }

    const answers = db.prepare('SELECT * FROM answers WHERE assessment_id = ?').all(assessment.id);
    const { totalScore, maxScore, percentage, level } = calculateScores(answers);
    const axisScores = calculateAxisScores(answers);

    db.prepare(`
      UPDATE assessments
      SET status = 'completed', total_score = ?, max_score = ?, percentage = ?, level = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totalScore, maxScore, percentage, level, assessment.id);

    const updatedAssessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessment.id);
    return NextResponse.json({ assessment: updatedAssessment, axisScores, answers });
  } catch (err) {
    console.error('Complete assessment error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
