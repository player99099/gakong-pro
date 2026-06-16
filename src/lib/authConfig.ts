/** 개발·테스트 시 로그인 화면 생략 (.env: VITE_SKIP_AUTH=true) */
export const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === 'true';

/** SKIP_AUTH일 때 Supabase 자동 로그인 (RLS 쓰기용) */
export const DEV_LOGIN_EMAIL =
  import.meta.env.VITE_DEV_LOGIN_EMAIL || 'test@test.com';

export const DEV_LOGIN_PASSWORD =
  import.meta.env.VITE_DEV_LOGIN_PASSWORD || '0000';

export const DEV_USER_EMAIL = DEV_LOGIN_EMAIL;
