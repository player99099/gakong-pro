/**
 * orders 필수 컬럼 보강 (005) — defect_quantity 등 누락 시
 * .env에 SUPABASE_DB_PASSWORD 필요
 * 사용: npm run db:migrate:orders
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REQUIRED_COLUMNS = [
  'produced_quantity',
  'defect_quantity',
  'seq_no',
  'vendor_unit_price',
  'vendor_amount',
];

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
    resolve(__dirname, '../supabase/migrations/005_orders_required_columns.sql'),
    'utf-8',
  );
  console.log('▶ 005_orders_required_columns.sql 적용 중...');
  await client.query(sql);
  console.log('✅ 005_orders_required_columns.sql 완료');

  const verify = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = ANY($1::text[])
    ORDER BY column_name
  `,
    [REQUIRED_COLUMNS],
  );
  const found = verify.rows.map((r) => r.column_name);
  const missing = REQUIRED_COLUMNS.filter((c) => !found.includes(c));

  if (missing.length === 0) {
    console.log('✅ orders 필수 컬럼 확인:', found.join(', '));
  } else {
    console.error('❌ 누락 컬럼:', missing.join(', '));
    process.exit(1);
  }
} catch (err) {
  console.error('❌ 오류:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
