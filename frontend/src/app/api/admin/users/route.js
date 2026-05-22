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
    const users = db.prepare(
      'SELECT id, name, email, role, organization, created_at FROM users ORDER BY created_at DESC'
    ).all();

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
