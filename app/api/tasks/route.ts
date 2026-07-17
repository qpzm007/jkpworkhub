import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { broadcastSSE } from './sse/route';

// GET /api/tasks — 내 업무 목록
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id },
    include: { files: true },
    orderBy: { createdAt: 'desc' },
  });

  const formattedTasks = tasks.map((t) => ({
    id: t.id,
    userId: t.userId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    department: t.department,
    assignee: t.assignee,
    folder: t.folder,
    deliveryDate: t.deliveryDate,
    delivery_date: t.deliveryDate,
    completedAt: t.completedAt ? t.completedAt.getTime() : null,
    completed_at: t.completedAt ? t.completedAt.getTime() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    files: t.files.map((f) => ({
      id: f.id,
      taskId: f.taskId,
      filePath: f.filePath,
      fileName: f.fileName,
      createdAt: f.createdAt.toISOString(),
    })),
  }));

  return NextResponse.json(formattedTasks);
}

// POST /api/tasks — 업무 추가 또는 벌크 업서트
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  if (body.tasks && Array.isArray(body.tasks)) {
    // 벌크 업서트
    const results = [];
    for (const task of body.tasks) {
      const dbTask = await prisma.task.upsert({
        where: { id: task.id },
        update: {
          title: task.title ?? '',
          description: task.description ?? '',
          status: task.status ?? 'inbox',
          priority: task.priority ?? 'medium',
          department: task.department ?? 'all',
          assignee: task.assignee ?? null,
          folder: task.folder ?? 'none',
          deliveryDate: task.deliveryDate ?? task.delivery_date ?? null,
          completedAt: task.completedAt || task.completed_at ? new Date(task.completedAt || task.completed_at) : null,
        },
        create: {
          id: task.id,
          userId: session.user.id,
          title: task.title ?? '',
          description: task.description ?? '',
          status: task.status ?? 'inbox',
          priority: task.priority ?? 'medium',
          department: task.department ?? 'all',
          assignee: task.assignee ?? null,
          folder: task.folder ?? 'none',
          deliveryDate: task.deliveryDate ?? task.delivery_date ?? null,
          completedAt: task.completedAt || task.completed_at ? new Date(task.completedAt || task.completed_at) : null,
        },
      });
      results.push(dbTask);
    }

    broadcastSSE({ type: 'tasks_updated', userId: session.user.id });
    return NextResponse.json({ success: true, count: results.length });
  } else {
    // 단일 태스크 생성
    const { title, description, status, priority, department, assignee, folder, deliveryDate, delivery_date } = body;
    
    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        title: title ?? '제목 없음',
        description: description ?? '',
        status: status ?? 'inbox',
        priority: priority ?? 'medium',
        department: department ?? 'all',
        assignee: assignee ?? null,
        folder: folder ?? 'none',
        deliveryDate: deliveryDate ?? delivery_date ?? null,
        completedAt: status === 'done' || status === 'completed' ? new Date() : null,
      },
    });

    broadcastSSE({ type: 'tasks_updated', userId: session.user.id });
    return NextResponse.json(task);
  }
}
