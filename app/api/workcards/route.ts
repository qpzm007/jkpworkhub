import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/workcards
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cards = await prisma.workCard.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const formattedCards = cards.map((c) => ({
    card_id: c.cardId,
    id: c.cardId,
    name: c.name,
    company: c.company,
    position: c.position,
    mobile: c.mobile,
    phone: c.phone,
    email: c.email,
    fax: c.fax,
    address: c.address,
    website_url: c.websiteUrl,
    sns: c.sns,
    image_front_base64: c.imageFrontBase64,
    image_back_base64: c.imageBackBase64,
    tags: c.tags,
    relationship: c.relationship,
    rating: c.rating,
    meet_location: c.meetLocation,
    memo: c.memo,
    is_shared: c.isShared,
    raw_ocr_text: c.rawOcrText,
    created_at: c.createdAt.toISOString(),
  }));

  return NextResponse.json(formattedCards);
}

// POST /api/workcards — 전체 교체
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards } = await req.json();
  if (!Array.isArray(cards)) return NextResponse.json({ error: 'cards must be array' }, { status: 400 });

  const userId = session.user.id;

  await prisma.$transaction([
    prisma.workCard.deleteMany({ where: { userId } }),
    prisma.workCard.createMany({
      data: cards.map((c: any) => ({
        cardId: c.card_id ?? c.id ?? crypto.randomUUID(),
        userId,
        name: c.name ?? '',
        company: c.company ?? '',
        position: c.position ?? '',
        mobile: c.mobile ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        fax: c.fax ?? '',
        address: c.address ?? '',
        websiteUrl: c.website_url ?? '',
        sns: c.sns ?? '',
        imageFrontBase64: c.image_front_base64 ?? null,
        imageBackBase64: c.image_back_base64 ?? null,
        tags: c.tags ?? '',
        relationship: c.relationship ?? '',
        rating: c.rating ?? 0,
        meetLocation: c.meet_location ?? '',
        memo: c.memo ?? '',
        isShared: c.is_shared ?? false,
        rawOcrText: c.raw_ocr_text ?? '',
      })),
    }),
  ]);

  return NextResponse.json({ success: true, count: cards.length });
}
