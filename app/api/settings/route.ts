import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`SELECT * FROM user_settings WHERE user_id = ${session.user.id}`;
  if (rows.length === 0) return NextResponse.json({});
  return NextResponse.json(rows[0]);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { api_key, ai_context, custom_names, user_folder_schema, bridge_url } = body;

  await sql`
    INSERT INTO user_settings (user_id, api_key, ai_context, custom_names, user_folder_schema, bridge_url, updated_at)
    VALUES (${session.user.id}, ${api_key ?? ''}, ${ai_context ?? ''}, ${custom_names ?? {}}::jsonb, ${user_folder_schema ?? {}}::jsonb, ${bridge_url ?? 'http://localhost:45679'}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      api_key = EXCLUDED.api_key,
      ai_context = EXCLUDED.ai_context,
      custom_names = EXCLUDED.custom_names,
      user_folder_schema = EXCLUDED.user_folder_schema,
      bridge_url = EXCLUDED.bridge_url,
      updated_at = NOW()
  `;

  return NextResponse.json({ success: true });
}
