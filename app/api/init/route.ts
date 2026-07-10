import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';

// GET /api/init — Vercel 첫 배포 후 DB 테이블 생성
export async function GET() {
  try {
    await initDb();
    return NextResponse.json({ success: true, message: 'Database initialized successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
