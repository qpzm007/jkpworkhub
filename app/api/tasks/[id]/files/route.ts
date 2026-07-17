import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { broadcastSSE } from '../../sse/route';

// POST /api/tasks/[id]/files — 파일 링크 추가
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { filePath, fileName } = await req.json();

  if (!filePath || !fileName) {
    return NextResponse.json({ error: 'filePath and fileName required' }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
  }

  const fileLink = await prisma.taskFile.create({
    data: {
      taskId: id,
      filePath,
      fileName,
    },
  });

  broadcastSSE({ type: 'tasks_updated', userId: session.user.id });

  return NextResponse.json({ success: true, data: fileLink });
}

// GET /api/tasks/[id]/files — 연결된 파일 목록 조회
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or Unauthorized' }, { status: 404 });
  }

  const files = await prisma.taskFile.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(files);
}

// DELETE /api/tasks/[id]/files — 연결된 파일 링크 삭제
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { fileId } = await req.json();

  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 });
  }

  // 태스크 및 파일 링크 매칭 확인
  const fileLink = await prisma.taskFile.findUnique({ where: { id: fileId } });
  if (!fileLink || fileLink.taskId !== id) {
    return NextResponse.json({ error: 'File link not found' }, { status: 404 });
  }

  await prisma.taskFile.delete({ where: { id: fileId } });

  broadcastSSE({ type: 'tasks_updated', userId: session.user.id });

  return NextResponse.json({ success: true });
}
