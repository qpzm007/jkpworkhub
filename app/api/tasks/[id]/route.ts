import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { broadcastSSE } from '../sse/route';

// DELETE /api/tasks/[id] — 특정 업무 삭제
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });

  broadcastSSE({ type: 'tasks_updated', userId: session.user.id });
  return NextResponse.json({ success: true });
}

// PUT /api/tasks/[id] — 업무 상세 수정
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
  }

  const { title, description, status, priority, department, assignee, folder, deliveryDate, delivery_date } = body;

  let completedAt = task.completedAt;
  if (status !== undefined && status !== task.status) {
    if (status === 'done' || status === 'completed') {
      completedAt = new Date();
    } else {
      completedAt = null;
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      title: title !== undefined ? title : task.title,
      description: description !== undefined ? description : task.description,
      status: status !== undefined ? status : task.status,
      priority: priority !== undefined ? priority : task.priority,
      department: department !== undefined ? department : task.department,
      assignee: assignee !== undefined ? assignee : task.assignee,
      folder: folder !== undefined ? folder : task.folder,
      deliveryDate: deliveryDate !== undefined ? deliveryDate : (delivery_date !== undefined ? delivery_date : task.deliveryDate),
      completedAt,
    },
  });

  broadcastSSE({ type: 'tasks_updated', userId: session.user.id });

  return NextResponse.json({
    ...updatedTask,
    completedAt: updatedTask.completedAt ? updatedTask.completedAt.getTime() : null,
    completed_at: updatedTask.completedAt ? updatedTask.completedAt.getTime() : null,
  });
}
