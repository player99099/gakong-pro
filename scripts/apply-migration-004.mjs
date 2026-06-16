/**
 * orders.seq_no 등 엑셀 연동 컬럼만 적용 (004)
 * .env에 SUPABASE_DB_PASSWORD 필요
 * 사용: npm run db:migrate:004
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '../.env');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
}

loadEnv();

function getProjectRef() {
  const url = process.env.VITE_SUPABASE_URL ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? 'myhujwvcrdzamsxwxeff';
}

const projectRef = getProjectRef();
const password = process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error('❌ .env에 SUPABASE_DB_PASSWORD를 추가해 주세요.');
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('🔗 DB 연결 성공');

  const sql = readFileSync(
    resolve(__dirname, '../supabase/migrations/004_orders_seq_bom.sql'),
    'utf-8',
  );
  console.log('▶ 004_orders_seq_bom.sql 적용 중...');
  await client.query(sql);
  console.log('✅ 004_orders_seq_bom.sql 완료');

  const verify = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name IN ('seq_no', 'vendor_unit_price', 'vendor_amount')
    ORDER BY column_name
  `);
  console.log('✅ orders 컬럼 확인:', verify.rows.map((r) => r.column_name).join(', '));
} catch (err) {
  console.error('❌ 오류:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
