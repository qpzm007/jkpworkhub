import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/tasks/recurring — 반복 업무 템플릿 목록
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const templates = await prisma.recurringTask.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(templates);
}

// POST /api/tasks/recurring — 반복 업무 템플릿 추가 및 수정
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, title, period, dayOfWeek, dayOfMonth, assignee, department, isActive } = body;

  if (!title || !period) {
    return NextResponse.json({ error: 'title and period required' }, { status: 400 });
  }

  const data = {
    title,
    period,
    dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
    dayOfMonth: dayOfMonth !== undefined && dayOfMonth !== null ? Number(dayOfMonth) : null,
    assignee: assignee ?? null,
    department: department ?? 'all',
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  };

  let template;
  if (id) {
    const existing = await prisma.recurringTask.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
    }
    template = await prisma.recurringTask.update({
      where: { id },
      data,
    });
  } else {
    template = await prisma.recurringTask.create({
      data: {
        userId: session.user.id,
        ...data,
      },
    });
  }

  return NextResponse.json(template);
}

// DELETE /api/tasks/recurring — 템플릿 삭제
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const template = await prisma.recurringTask.findUnique({ where: { id } });
  if (!template || template.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
  }

  await prisma.recurringTask.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
