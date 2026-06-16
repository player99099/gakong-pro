/**
 * 새 PC(집/회사)에서 clone 후 1회 실행
 * usage: npm run setup
 */
import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const envExamplePath = join(root, '.env.example');

console.log('=== 가공관리 Pro — 로컬 PC 초기 설정 ===\n');

const install = spawnSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell: true });
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('\n.env 파일을 생성했습니다.');
  console.log('→ .env 를 열어 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 입력하세요.');
  console.log('  (집·회사 PC는 동일한 Supabase 프로젝트 키를 사용)\n');
} else {
  console.log('\n.env 가 이미 있습니다. (건너뜀)\n');
}

console.log('Supabase 연결 점검...');
const check = spawnSync('npm', ['run', 'db:check'], { cwd: root, stdio: 'inherit', shell: true });

console.log('\n=== 다음 단계 ===');
console.log('1. .env 설정 확인');
console.log('2. DB 마이그레이션 미적용 시: Supabase SQL Editor → supabase/migrations/ (006~008 등)');
console.log('3. npm run dev → http://localhost:5173/');
console.log('\nGit 원격: https://github.com/player99099/gakong-pro.git');

process.exit(check.status ?? 0);
