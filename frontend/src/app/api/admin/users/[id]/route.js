import { NextResponse } from 'next/server';
import { getDbReady } from '@/lib/db';
import { authenticate } from '@/lib/auth-helpers';

export async function DELETE(request, { params }) {
  try {
    const currentUser = await authenticate(request);
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    const db = await getDbReady();
    const userId = parseInt(params.id, 10);

    if (userId === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const userAssessments = db.prepare('SELECT id FROM assessments WHERE user_id = ?').all(userId);
    for (const a of userAssessments) {
      db.prepare('DELETE FROM answers WHERE assessment_id = ?').run(a.id);
    }
    db.prepare('DELETE FROM assessments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return NextResponse.json({ message: 'User deleted successfully.' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
