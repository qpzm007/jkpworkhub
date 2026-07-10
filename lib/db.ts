import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
export default sql;

// DB 초기화 - 모든 테이블 생성
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      api_key TEXT DEFAULT '',
      ai_context TEXT DEFAULT '',
      custom_names JSONB DEFAULT '{}',
      user_folder_schema JSONB DEFAULT '{}',
      bridge_url TEXT DEFAULT 'http://localhost:45679',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      department TEXT,
      assignee TEXT,
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending_approval',
      delivery_date TEXT,
      items_count INTEGER DEFAULT 0,
      description TEXT,
      priority TEXT,
      folder TEXT,
      completed_at BIGINT,
      timeline TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS work_cards (
      card_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      company TEXT,
      position TEXT,
      mobile TEXT,
      phone TEXT,
      email TEXT,
      fax TEXT,
      address TEXT,
      website_url TEXT,
      sns TEXT,
      image_front_base64 TEXT,
      image_back_base64 TEXT,
      tags TEXT,
      relationship TEXT,
      rating INTEGER DEFAULT 0,
      meet_location TEXT,
      memo TEXT,
      is_shared BOOLEAN DEFAULT FALSE,
      raw_ocr_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_work_cards_user_id ON work_cards(user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS shared_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      asset_number TEXT,
      category TEXT,
      format TEXT,
      owner_name TEXT,
      status TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_shared_assets_user_id ON shared_assets(user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS member_access (
      requester_id TEXT NOT NULL,
      target_email TEXT NOT NULL,
      target_user_id TEXT,
      display_name TEXT,
      status TEXT DEFAULT 'pending',
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      PRIMARY KEY (requester_id, target_email)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_member_access_target_email ON member_access(target_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_member_access_requester_id ON member_access(requester_id)`;
}
