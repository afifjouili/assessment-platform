import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { optionalAuthenticate } from '@/lib/auth-helpers';
import { calculateAxisScores, AXES } from '@/lib/scoring';

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
    const levelLabels = { high: 'مرتفع', good: 'جيد', medium: 'متوسط', low: 'ضعيف' };

    const detailedAxes = AXES.map(axis => {
      const axisScore = axisScores.find(s => s.axisId === axis.id);
      return {
        id: axis.id,
        name: axis.name,
        score: axisScore ? axisScore.score : 0,
        maxScore: axisScore ? axisScore.maxScore : axis.questions.length * 2,
        percentage: axisScore ? axisScore.percentage : 0,
        questions: axis.questions.map((q, idx) => {
          const answer = answers.find(a => a.axis_id === axis.id && a.question_index === idx);
          return {
            text: q,
            score: answer ? answer.score : null,
            scoreLabel: answer
              ? { 0: 'غير مطبق', 1: 'تطبيق جزئي', 2: 'مطبق بالكامل' }[answer.score]
              : 'لم تتم الإجابة'
          };
        })
      };
    });

    return NextResponse.json({
      assessment: { ...assessment, levelLabel: levelLabels[assessment.level] || assessment.level },
      axisScores,
      detailedAxes,
      user: user || null
    });
  } catch (err) {
    console.error('PDF data export error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
