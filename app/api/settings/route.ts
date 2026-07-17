import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id }
  });

  if (!settings) return NextResponse.json({});

  return NextResponse.json({
    userId: settings.userId,
    api_key: settings.apiKey,
    ai_context: settings.aiContext,
    custom_names: JSON.parse(settings.customNames || '{}'),
    user_folder_schema: JSON.parse(settings.userFolderSchema || '{}'),
    bridge_url: settings.bridgeUrl,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { api_key, ai_context, custom_names, user_folder_schema, bridge_url } = body;

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: {
      apiKey: api_key ?? '',
      aiContext: ai_context ?? '',
      customNames: typeof custom_names === 'object' ? JSON.stringify(custom_names) : (custom_names ?? '{}'),
      userFolderSchema: typeof user_folder_schema === 'object' ? JSON.stringify(user_folder_schema) : (user_folder_schema ?? '{}'),
      bridgeUrl: bridge_url ?? 'http://localhost:45679',
    },
    create: {
      userId: session.user.id,
      apiKey: api_key ?? '',
      aiContext: ai_context ?? '',
      customNames: typeof custom_names === 'object' ? JSON.stringify(custom_names) : (custom_names ?? '{}'),
      userFolderSchema: typeof user_folder_schema === 'object' ? JSON.stringify(user_folder_schema) : (user_folder_schema ?? '{}'),
      bridgeUrl: bridge_url ?? 'http://localhost:45679',
    }
  });

  return NextResponse.json({ success: true });
}
