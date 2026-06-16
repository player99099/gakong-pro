/**
 * 작업지시·생산일보 등 MVP 테이블 적용 (003)
 *
 * .env에 SUPABASE_DB_PASSWORD 또는 실행 시 인자:
 *   node scripts/apply-migration-003.mjs --password=YOUR_DB_PASSWORD
 *
 * 사용: npm run db:migrate:003
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectSupabasePg } from './lib/pgConnect.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}

function parsePasswordArg() {
  const arg = process.argv.find((a) => a.startsWith('--password='));
  return arg ? arg.slice('--password='.length) : null;
}

function persistPasswordToEnv(password) {
  const envPath = resolve(__dirname, '../.env');
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  if (/^SUPABASE_DB_PASSWORD=/m.test(content)) {
    content = content.replace(
      /^SUPABASE_DB_PASSWORD=.*$/m,
      `SUPABASE_DB_PASSWORD=${password}`,
    );
  } else {
    content =
      content.trimEnd() +
      (content.endsWith('\n') ? '' : '\n') +
      `\n# DB migration (Git/채팅 공유 금지)\nSUPABASE_DB_PASSWORD=${password}\n`;
  }
  writeFileSync(envPath, content, 'utf-8');
}

loadEnv();

const password = process.env.SUPABASE_DB_PASSWORD || parsePasswordArg();

if (!password) {
  console.error('❌ SUPABASE_DB_PASSWORD가 없습니다.');
  console.error('   .env에 추가하거나:');
  console.error('   node scripts/apply-migration-003.mjs --password=DB비밀번호');
  console.error('   Supabase → Project Settings → Database → Database password');
  process.exit(1);
}

let client;
let connectedVia = '';

try {
  const conn = await connectSupabasePg(password);
  client = conn.client;
  connectedVia = conn.label;
  console.log(`🔗 DB 연결 성공 (${connectedVia})`);

  const sql = readFileSync(
    resolve(__dirname, '../supabase/migrations/003_full_mvp.sql'),
    'utf-8',
  );
  console.log('▶ 003_full_mvp.sql 적용 중...');
  await client.query(sql);
  console.log('✅ 003_full_mvp.sql 완료');

  if (parsePasswordArg() && !process.env.SUPABASE_DB_PASSWORD) {
    persistPasswordToEnv(password);
    console.log('✅ .env에 SUPABASE_DB_PASSWORD 저장됨');
  }

  const verify = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('work_orders', 'production_logs', 'process_logs')
    ORDER BY table_name
  `);
  console.log(
    '✅ 테이블 확인:',
    verify.rows.map((r) => r.table_name).join(', ') || '(없음)',
  );
} catch (err) {
  console.error('❌ 오류:', err.message);
  process.exit(1);
} finally {
  if (client) await client.end();
}
