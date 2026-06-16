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
  'print_templates',
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
console.log('📌 orders 필수 컬럼 (엑셀·저장):');

const ORDER_REQUIRED_COLUMNS = [
  'seq_no',
  'produced_quantity',
  'defect_quantity',
  'vendor_unit_price',
  'vendor_amount',
];

let ordersColumnsOk = true;

for (const col of ORDER_REQUIRED_COLUMNS) {
  try {
    const res = await fetch(`${url}/rest/v1/orders?select=${col}&limit=1`, { headers });
    if (res.ok) {
      console.log(`✅ orders.${col}`);
    } else {
      const body = await res.json().catch(() => ({}));
      if (body.code === '42703' || String(body.message ?? '').includes(col)) {
        console.log(`❌ orders.${col} — 컬럼 없음 → npm run db:migrate:orders 실행`);
        ordersColumnsOk = false;
      } else {
        console.log(`⚠️  orders.${col} — ${res.status} ${body.message ?? ''}`);
        ordersColumnsOk = false;
      }
    }
  } catch (err) {
    console.log(`❌ orders.${col} 확인 실패:`, err.message);
    ordersColumnsOk = false;
  }
}

if (ordersColumnsOk) {
  console.log('✅ orders — 엑셀 업로드·저장 DB 준비됨');
}

console.log('');
console.log('📌 작업지시 메뉴: work_orders 테이블 필요 → npm run db:migrate:003');
console.log('📌 출력 양식 저장: print_templates → 006 + 007 migration');
console.log('📌 Excel 양식 Storage 버킷: print-templates (Supabase Dashboard)');
console.log('📌 테이블이 없으면: npm run db:migrate (002→003→004→005)');
console.log('📌 orders 컬럼만 보강: npm run db:migrate:orders');
console.log('   또는 Supabase SQL Editor에서 supabase/migrations/005_orders_required_columns.sql 실행');
console.log('📌 로그인 계정: Authentication → Users → Add user');
