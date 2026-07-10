import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/tasks — 내 업무 목록
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await sql`
    SELECT * FROM tasks WHERE user_id = ${session.user.id} ORDER BY created_at DESC
  `;
  return NextResponse.json(tasks);
}

// POST /api/tasks — 업무 UPSERT (전체 배열)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tasks } = await req.json();
  if (!Array.isArray(tasks)) return NextResponse.json({ error: 'tasks must be array' }, { status: 400 });

  for (const task of tasks) {
    await sql`
      INSERT INTO tasks (id, user_id, title, department, assignee, amount, status, delivery_date, items_count, description, priority, folder, completed_at, timeline, updated_at)
      VALUES (
        ${task.id}, ${session.user.id}, ${task.title ?? ''}, ${task.department ?? ''},
        ${task.assignee ?? ''}, ${task.amount ?? 0}, ${task.status ?? 'pending_approval'},
        ${task.deliveryDate ?? task.delivery_date ?? ''}, ${task.itemsCount ?? task.items_count ?? 0},
        ${task.description ?? ''}, ${task.priority ?? ''}, ${task.folder ?? ''},
        ${task.completedAt ?? task.completed_at ?? null}, ${task.timeline ? JSON.stringify(task.timeline) : null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        department = EXCLUDED.department,
        assignee = EXCLUDED.assignee,
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        delivery_date = EXCLUDED.delivery_date,
        items_count = EXCLUDED.items_count,
        description = EXCLUDED.description,
        priority = EXCLUDED.priority,
        folder = EXCLUDED.folder,
        completed_at = EXCLUDED.completed_at,
        timeline = EXCLUDED.timeline,
        updated_at = NOW()
    `;
  }

  return NextResponse.json({ success: true, count: tasks.length });
}
