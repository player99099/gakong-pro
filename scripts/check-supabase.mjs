/**
 * Supabase 연결 및 테이블 존재 여부 확인 스크립트
 * 사용: node scripts/check-supabase.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {
    // .env 없음
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const tables = [
  'customers',
  'vendors',
  'items',
  'bom_items',
  'orders',
  'deliveries',
  'delivery_items',
  'work_orders',
  'process_logs',
  'production_logs',
  'process_steps',
  'defect_types',
  'setup_types',
  'surface_treatments',
  'company_settings',
  'users_profile',
];

if (!url || !key) {
  console.error('❌ .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요합니다.');
  process.exit(1);
}

console.log('🔗 Supabase URL:', url);
console.log('');

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

for (const table of tables) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers });
    if (res.ok) {
      console.log(`✅ ${table} — 테이블 존재`);
    } else {
      const body = await res.json().catch(() => ({}));
      if (body.code === 'PGRST205') {
        console.log(`❌ ${table} — 테이블 없음 (schema.sql 실행 필요)`);
      } else {
        console.log(`⚠️  ${table} — ${res.status} ${body.message ?? ''}`);
      }
    }
  } catch (err) {
    console.log(`❌ ${table} — 연결 실패:`, err.message);
  }
}

console.log('');
console.log('📌 테이블이 없으면 Supabase 대시보드 → SQL Editor에서 supabase/schema.sql 실행');
console.log('📌 로그인 계정: Authentication → Users → Add user');
