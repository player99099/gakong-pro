/**
 * Supabase DB에 migration SQL 적용 (002 → 003)
 *
 * .env에 SUPABASE_DB_PASSWORD 필요
 * 사용: node scripts/apply-migrations.mjs
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

const projectRef = 'myhujwvcrdzamsxwxeff';
const password = process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error('❌ .env에 SUPABASE_DB_PASSWORD를 추가해 주세요.');
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;

const migrations = [
  '002_deliveries.sql',
  '003_full_mvp.sql',
];

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('🔗 DB 연결 성공');

  for (const file of migrations) {
    const sql = readFileSync(
      resolve(__dirname, `../supabase/migrations/${file}`),
      'utf-8',
    );
    console.log(`▶ ${file} 적용 중...`);
    await client.query(sql);
    console.log(`✅ ${file} 완료`);
  }

  console.log('✅ migration 적용 완료');
} catch (err) {
  console.error('❌ 오류:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
