import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDbReady } from '@/lib/db';
import { signToken } from '@/lib/auth-helpers';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const db = await getDbReady();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = signToken(user.id);
    const { password_hash, ...safeUser } = user;
    return NextResponse.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
