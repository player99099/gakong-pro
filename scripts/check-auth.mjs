/**
 * Supabase 로그인·RLS 쓰기 점검
 * 사용: node scripts/check-auth.mjs
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
    /* ignore */
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.VITE_DEV_LOGIN_EMAIL || 'test@test.com';
const password = process.env.VITE_DEV_LOGIN_PASSWORD || '0000';

if (!url || !key) {
  console.error('❌ .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요합니다.');
  process.exit(1);
}

console.log('🔐 로그인 테스트:', email);

const loginRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const loginBody = await loginRes.json();

if (!loginRes.ok || !loginBody.access_token) {
  console.error('❌ 로그인 실패:', loginBody.error_description || loginBody.msg || loginRes.status);
  console.error('   → Supabase Authentication에서 사용자 생성 또는 VITE_DEV_LOGIN_PASSWORD 확인');
  process.exit(1);
}

console.log('✅ 로그인 성공 (authenticated 세션)');

const token = loginBody.access_token;
const authHeaders = {
  apikey: key,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const insertRes = await fetch(`${url}/rest/v1/orders`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    seq_no: '__auth_check__',
    drawing_no: 'TEST',
    item_name: 'TEST',
    order_status: '접수',
    process_status: '수주접수',
    created_by: email,
    updated_by: email,
  }),
});

const insertText = await insertRes.text();
if (!insertRes.ok) {
  console.error('❌ orders INSERT 실패 (RLS 또는 스키마):', insertText);
  process.exit(1);
}

console.log('✅ orders INSERT — RLS 쓰기 가능');

const updateRes = await fetch(`${url}/rest/v1/orders?seq_no=eq.__auth_check__`, {
  method: 'PATCH',
  headers: authHeaders,
  body: JSON.stringify({ item_name: 'TEST2', updated_by: email }),
});

if (!updateRes.ok) {
  console.error('❌ orders UPDATE 실패:', await updateRes.text());
} else {
  console.log('✅ orders UPDATE — seq_no 기준 수정 가능');
}

await fetch(`${url}/rest/v1/orders?seq_no=eq.__auth_check__`, {
  method: 'DELETE',
  headers: { apikey: key, Authorization: `Bearer ${token}` },
});

console.log('');
console.log('📌 엑셀 upsert: PostgREST onConflict(seq_no)는 부분 유니크 인덱스와 호환되지 않을 수 있습니다.');
console.log('   앱은 insert/update 분기 방식으로 저장합니다.');
