import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth-helpers';

export async function GET(request) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
}
