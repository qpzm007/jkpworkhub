import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/workcards
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cards = await sql`SELECT * FROM work_cards WHERE user_id = ${session.user.id} ORDER BY created_at DESC`;
  return NextResponse.json(cards);
}

// POST /api/workcards — 전체 교체
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards } = await req.json();
  if (!Array.isArray(cards)) return NextResponse.json({ error: 'cards must be array' }, { status: 400 });

  await sql`DELETE FROM work_cards WHERE user_id = ${session.user.id}`;

  for (const card of cards) {
    await sql`
      INSERT INTO work_cards (card_id, user_id, name, company, position, mobile, phone, email, fax, address, website_url, sns, image_front_base64, image_back_base64, tags, relationship, rating, meet_location, memo, is_shared, raw_ocr_text)
      VALUES (
        ${card.card_id ?? card.id ?? crypto.randomUUID()},
        ${session.user.id},
        ${card.name ?? ''}, ${card.company ?? ''}, ${card.position ?? ''},
        ${card.mobile ?? ''}, ${card.phone ?? ''}, ${card.email ?? ''},
        ${card.fax ?? ''}, ${card.address ?? ''}, ${card.website_url ?? ''},
        ${card.sns ?? ''}, ${card.image_front_base64 ?? null}, ${card.image_back_base64 ?? null},
        ${card.tags ?? ''}, ${card.relationship ?? ''}, ${card.rating ?? 0},
        ${card.meet_location ?? ''}, ${card.memo ?? ''}, ${card.is_shared ?? false},
        ${card.raw_ocr_text ?? ''}
      )
    `;
  }

  return NextResponse.json({ success: true, count: cards.length });
}
