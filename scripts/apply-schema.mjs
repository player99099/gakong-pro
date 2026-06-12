/**
 * Supabase DB에 schema.sql 자동 적용
 *
 * .env에 아래 추가 후 실행:
 *   SUPABASE_DB_PASSWORD=프로젝트생성시설정한DB비밀번호
 *
 * 사용: node scripts/apply-schema.mjs
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
  console.error('   Supabase → Project Settings → Database → Database password');
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;

const sql = readFileSync(resolve(__dirname, '../supabase/schema.sql'), 'utf-8');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('🔗 DB 연결 성공');
  await client.query(sql);
  console.log('✅ schema.sql 적용 완료');
} catch (err) {
  console.error('❌ 오류:', err.message);
  if (err.message.includes('password authentication failed')) {
    console.error('   DB 비밀번호를 확인해 주세요.');
  }
  if (err.message.includes('ENOTFOUND') || err.message.includes('timeout')) {
    console.error('   Region이 다를 수 있습니다. Supabase Database 설정의 Connection string을 확인하세요.');
  }
  process.exit(1);
} finally {
  await client.end();
}
