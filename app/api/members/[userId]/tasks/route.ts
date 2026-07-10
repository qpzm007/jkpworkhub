import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/members/[userId]/tasks — 부서원 업무 읽기전용
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;

  // 내가 이 사람에게 승인된 접근 권한이 있는지 확인
  const access = await sql`
    SELECT status FROM member_access
    WHERE requester_id = ${session.user.id} AND target_user_id = ${userId} AND status = 'approved'
    LIMIT 1
  `;

  if (access.length === 0) {
    return NextResponse.json({ error: '접근 권한이 없습니다. 상대방의 승인이 필요합니다.' }, { status: 403 });
  }

  const tasks = await sql`
    SELECT id, title, department, assignee, amount, status, delivery_date, items_count,
           priority, folder, completed_at, created_at
    FROM tasks
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  // 읽기전용: description(상세내용)과 timeline은 제외
  return NextResponse.json(tasks);
}
