import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { broadcastSSE } from '../sse/route';

// POST /api/tasks/generate-recurring — 반복 업무 자동 생성 실행
export async function POST() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0(일) ~ 6(토)
  const dayOfMonth = today.getDate(); // 1 ~ 31

  // 1. 활성화된 모든 반복 업무 템플릿 로드
  const activeTemplates = await prisma.recurringTask.findMany({
    where: { isActive: true },
  });

  let generatedCount = 0;
  const userIdsToNotify = new Set<string>();

  for (const template of activeTemplates) {
    let shouldGenerate = false;

    // 반복 주기 판정
    if (template.period === 'daily') shouldGenerate = true;
    else if (template.period === 'weekly' && template.dayOfWeek === dayOfWeek) shouldGenerate = true;
    else if (template.period === 'monthly' && template.dayOfMonth === dayOfMonth) shouldGenerate = true;

    if (shouldGenerate) {
      // 2. 금일 동일 업무 중복 생성 검사
      const dateString = today.toISOString().split('T')[0];
      const startOfDay = new Date(`${dateString}T00:00:00.000Z`);

      const exist = await prisma.task.findFirst({
        where: {
          userId: template.userId,
          title: template.title,
          createdAt: {
            gte: startOfDay,
          },
        },
      });

      if (!exist) {
        // 3. 새로운 당일 Task 생성
        await prisma.task.create({
          data: {
            userId: template.userId,
            title: template.title,
            status: 'todo',
            assignee: template.assignee,
            department: template.department,
            folder: 'none',
          },
        });

        // 4. 마지막 생성 일시 갱신
        await prisma.recurringTask.update({
          where: { id: template.id },
          data: { lastGenerated: today },
        });

        generatedCount++;
        userIdsToNotify.add(template.userId);
      }
    }
  }

  // 변경 사항이 있는 유저들에 대해 SSE 브로드캐스트
  if (generatedCount > 0) {
    userIdsToNotify.forEach((uid) => {
      broadcastSSE({ type: 'tasks_updated', userId: uid });
    });
  }

  return NextResponse.json({ success: true, message: `반복 업무 생성 완료 (${generatedCount}건)` });
}
