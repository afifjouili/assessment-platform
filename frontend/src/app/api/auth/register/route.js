import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'إنشاء الحسابات الجديدة غير متاح حالياً. الرجاء الاتصال بمسؤول النظام.' },
    { status: 403 }
  );
}
