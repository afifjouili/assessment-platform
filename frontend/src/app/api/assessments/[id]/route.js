import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { optionalAuthenticate } from '@/lib/auth-helpers';
import { calculateAxisScores } from '@/lib/scoring';

// GET /api/assessments/[id]
export async function GET(request, { params }) {
  try {
    const user = await optionalAuthenticate(request);
    const db = await getDbReady();
    const { id } = params;

    let assessment;
    if (user && user.role === 'admin') {
      assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id);
    } else if (user) {
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

    const answers = db.prepare(
      'SELECT * FROM answers WHERE assessment_id = ? ORDER BY axis_id, question_index'
    ).all(assessment.id);

    const axisScores = calculateAxisScores(answers);
    return NextResponse.json({ assessment, answers, axisScores });
  } catch (err) {
    console.error('Get assessment error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// DELETE /api/assessments/[id]
export async function DELETE(request, { params }) {
  try {
    const user = await optionalAuthenticate(request);
    const db = await getDbReady();
    const { id } = params;

    let assessment;
    if (user && user.role === 'admin') {
      assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id);
    } else if (user) {
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

    db.prepare('DELETE FROM answers WHERE assessment_id = ?').run(assessment.id);
    db.prepare('DELETE FROM assessments WHERE id = ?').run(assessment.id);
    return NextResponse.json({ message: 'Assessment deleted successfully.' });
  } catch (err) {
    console.error('Delete assessment error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
