import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/members — 내가 추가한 부서원 목록
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 내가 요청한 목록 (나 → 상대)
  const outgoing = await sql`
    SELECT requester_id, target_email, target_user_id, display_name, status, requested_at, responded_at
    FROM member_access
    WHERE requester_id = ${session.user.id}
    ORDER BY requested_at DESC
  `;

  // 다른 사람이 나에게 요청한 목록 (상대 → 나)
  const incoming = await sql`
    SELECT requester_id, target_email, target_user_id, display_name, status, requested_at
    FROM member_access
    WHERE target_email = ${session.user.email!} AND status = 'pending'
    ORDER BY requested_at DESC
  `;

  return NextResponse.json({ outgoing, incoming });
}

// POST /api/members — 부서원 추가 요청
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { target_email, display_name } = await req.json();
  if (!target_email) return NextResponse.json({ error: 'target_email required' }, { status: 400 });

  // 50명 제한
  const count = await sql`SELECT COUNT(*) as cnt FROM member_access WHERE requester_id = ${session.user.id}`;
  if (Number(count[0].cnt) >= 50) {
    return NextResponse.json({ error: '최대 50명까지만 추가할 수 있습니다.' }, { status: 400 });
  }

  // 자기 자신 추가 금지
  if (target_email === session.user.email) {
    return NextResponse.json({ error: '자신을 추가할 수 없습니다.' }, { status: 400 });
  }

  // 이미 WorkHub에 가입된 사람인지 확인
  const existingUser = await sql`SELECT user_id FROM user_settings WHERE user_id IN (
    SELECT id FROM auth_accounts WHERE email = ${target_email} LIMIT 1
  ) LIMIT 1`;

  const targetUserId = existingUser.length > 0 ? existingUser[0].user_id : null;

  await sql`
    INSERT INTO member_access (requester_id, target_email, target_user_id, display_name, status)
    VALUES (${session.user.id}, ${target_email}, ${targetUserId}, ${display_name ?? target_email}, 'pending')
    ON CONFLICT (requester_id, target_email) DO NOTHING
  `;

  return NextResponse.json({ success: true, status: targetUserId ? 'pending' : 'not_registered' });
}

// DELETE /api/members — 부서원 제거
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { target_email } = await req.json();
  await sql`DELETE FROM member_access WHERE requester_id = ${session.user.id} AND target_email = ${target_email}`;
  return NextResponse.json({ success: true });
}
