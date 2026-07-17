import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/members/respond — 부서원 요청 수락/거부
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requester_id, action } = await req.json(); // action: 'approve' | 'reject'
  if (!requester_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const status = action === 'approve' ? 'approved' : 'rejected';

  await prisma.memberAccess.update({
    where: {
      requesterId_targetEmail: {
        requesterId: requester_id,
        targetEmail: session.user.email!,
      }
    },
    data: {
      status,
      respondedAt: new Date(),
      targetUserId: session.user.id,
    }
  });

  return NextResponse.json({ success: true, status });
}
