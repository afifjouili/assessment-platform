import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { authenticate, optionalAuthenticate } from '@/lib/auth-helpers';

// GET /api/assessments — List user's assessments
export async function GET(request) {
  try {
    const user = await authenticate(request);
    const db = await getDbReady();
    const assessments = db.prepare(
      'SELECT * FROM assessments WHERE user_id = ? ORDER BY started_at DESC'
    ).all(user.id);
    return NextResponse.json({ assessments });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

// POST /api/assessments — Create new assessment
export async function POST(request) {
  try {
    const user = await optionalAuthenticate(request);
    const { associationName } = await request.json();

    if (!associationName) {
      return NextResponse.json({ error: 'Association name is required.' }, { status: 400 });
    }

    const db = await getDbReady();
    const userId = user ? user.id : null;
    const result = db.prepare(
      'INSERT INTO assessments (association_name, user_id) VALUES (?, ?)'
    ).run(associationName, userId);

    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ assessment }, { status: 201 });
  } catch (err) {
    console.error('Create assessment error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
