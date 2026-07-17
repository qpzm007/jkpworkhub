import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/members/[userId]/tasks — 부서원 업무 읽기전용
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;

  // 내가 이 사람에게 승인된 접근 권한이 있는지 확인
  const access = await prisma.memberAccess.findFirst({
    where: {
      requesterId: session.user.id,
      targetUserId: userId,
      status: 'approved',
    },
  });

  if (!access) {
    return NextResponse.json({ error: '접근 권한이 없습니다. 상대방의 승인이 필요합니다.' }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // 읽기전용: description과 파일, 타임라인은 제외하고 기본 메타데이터만 호환되게 반환
  const formattedTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
    assignee: t.assignee,
    status: t.status,
    deliveryDate: t.deliveryDate,
    delivery_date: t.deliveryDate,
    priority: t.priority,
    folder: t.folder,
    completedAt: t.completedAt ? t.completedAt.getTime() : null,
    completed_at: t.completedAt ? t.completedAt.getTime() : null,
    created_at: t.createdAt.toISOString(),
  }));

  return NextResponse.json(formattedTasks);
}
