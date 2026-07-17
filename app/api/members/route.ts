import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/members — 내가 추가한 부서원 목록
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 내가 요청한 목록 (나 → 상대)
  const outgoingRows = await prisma.memberAccess.findMany({
    where: { requesterId: session.user.id },
    orderBy: { requestedAt: 'desc' }
  });

  // 다른 사람이 나에게 요청한 목록 (상대 → 나)
  const incomingRows = await prisma.memberAccess.findMany({
    where: {
      targetEmail: session.user.email!,
      status: 'pending'
    },
    orderBy: { requestedAt: 'desc' }
  });

  // 클라이언트 호환성을 위해 snake_case로 포맷팅
  const outgoing = outgoingRows.map(m => ({
    requester_id: m.requesterId,
    target_email: m.targetEmail,
    target_user_id: m.targetUserId,
    display_name: m.displayName,
    status: m.status,
    requested_at: m.requestedAt,
    responded_at: m.respondedAt,
  }));

  const incoming = incomingRows.map(m => ({
    requester_id: m.requesterId,
    target_email: m.targetEmail,
    target_user_id: m.targetUserId,
    display_name: m.displayName,
    status: m.status,
    requested_at: m.requestedAt,
    responded_at: m.respondedAt,
  }));

  return NextResponse.json({ outgoing, incoming });
}

// POST /api/members — 부서원 추가 요청
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { target_email, display_name } = await req.json();
  if (!target_email) return NextResponse.json({ error: 'target_email required' }, { status: 400 });

  // 50명 제한
  const count = await prisma.memberAccess.count({
    where: { requesterId: session.user.id }
  });
  if (count >= 50) {
    return NextResponse.json({ error: '최대 50명까지만 추가할 수 있습니다.' }, { status: 400 });
  }

  // 자기 자신 추가 금지
  if (target_email === session.user.email) {
    return NextResponse.json({ error: '자신을 추가할 수 없습니다.' }, { status: 400 });
  }

  // 이미 가입된 유저인지 조회
  const targetUserSetting = await prisma.userSettings.findUnique({
    where: { email: target_email }
  });
  const targetUserId = targetUserSetting ? targetUserSetting.userId : null;

  // 이미 요청이 존재하는지 확인
  const existing = await prisma.memberAccess.findUnique({
    where: {
      requesterId_targetEmail: {
        requesterId: session.user.id,
        targetEmail: target_email
      }
    }
  });

  if (!existing) {
    await prisma.memberAccess.create({
      data: {
        requesterId: session.user.id,
        targetEmail: target_email,
        targetUserId: targetUserId,
        displayName: display_name ?? target_email,
        status: 'pending'
      }
    });
  }

  return NextResponse.json({ success: true, status: targetUserId ? 'pending' : 'not_registered' });
}

// DELETE /api/members — 부서원 제거
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { target_email } = await req.json();

  await prisma.memberAccess.delete({
    where: {
      requesterId_targetEmail: {
        requesterId: session.user.id,
        targetEmail: target_email
      }
    }
  }).catch(() => {}); // 이미 존재하지 않는다면 무시

  return NextResponse.json({ success: true });
}
