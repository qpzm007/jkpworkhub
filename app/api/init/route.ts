import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/init — 데이터베이스 연결 확인
export async function GET() {
  try {
    // 연결 테스트를 위한 빈 쿼리 실행
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ success: true, message: 'SQLite database is ready and connected via Prisma.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
