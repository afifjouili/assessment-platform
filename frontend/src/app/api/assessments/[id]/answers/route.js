import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { optionalAuthenticate } from '@/lib/auth-helpers';
import { AXES } from '@/lib/questions';

// PUT /api/assessments/[id]/answers
export async function PUT(request, { params }) {
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
      return NextResponse.json({ error: 'Cannot modify a completed assessment.' }, { status: 400 });
    }

    const { answers } = await request.json();
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Answers array is required.' }, { status: 400 });
    }

    for (const answer of answers) {
      if (answer.axisId == null || answer.questionIndex == null || answer.score == null) {
        return NextResponse.json({ error: 'Each answer must have axisId, questionIndex, and score.' }, { status: 400 });
      }
      if (![0, 1, 2].includes(answer.score)) {
        return NextResponse.json({ error: 'Score must be 0, 1, or 2.' }, { status: 400 });
      }
      const axis = AXES.find(a => a.id === answer.axisId);
      if (!axis) {
        return NextResponse.json({ error: `Invalid axisId: ${answer.axisId}` }, { status: 400 });
      }
      if (answer.questionIndex < 0 || answer.questionIndex >= axis.questions.length) {
        return NextResponse.json({ error: `Invalid questionIndex ${answer.questionIndex} for axis ${answer.axisId}` }, { status: 400 });
      }
    }

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

    const updatedAnswers = db.prepare(
      'SELECT * FROM answers WHERE assessment_id = ? ORDER BY axis_id, question_index'
    ).all(assessment.id);

    return NextResponse.json({ message: 'Answers saved successfully.', answers: updatedAnswers });
  } catch (err) {
    console.error('Save answers error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
