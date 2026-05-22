import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { authenticate } from '@/lib/auth-helpers';

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    const db = await getDbReady();
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

    return NextResponse.json({ totalUsers, totalAssessments, avgScore, recentAssessments });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
