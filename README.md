# 가공관리 Pro

금속가공업체용 미니 ERP 웹 애플리케이션 (1차 기본 틀)

## 실행 방법

```bash
# 의존성 설치
npm install

# 환경변수 설정 (.env.example 참고)
cp .env.example .env

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## Supabase 환경변수

`.env` 파일에 다음 값을 설정하세요:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase 설정

1. Supabase 프로젝트 생성
2. Authentication > Users에서 테스트 사용자 생성 (이메일/비밀번호)
3. SQL Editor에서 `supabase/schema.sql` 실행
4. `.env`에 URL과 anon key 입력

## Vercel 배포

1. GitHub에 푸시
2. Vercel에서 프로젝트 import
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정
4. Deploy

## 1차 구현 범위

- 로그인 (Supabase Auth)
- 대시보드 (기본 통계)
- 고객사 CRUD
- 매입업체 CRUD
- 품목/BOM CRUD
- 수주관리 CRUD

## 다음 단계 예정

- 작업지시, 생산관리, 생산일보, 납품관리, 설정
- 거래명세표 출력, 공정이동표 출력

## GPT 총감독 / 협업 문서

- `HANDOFF.md` — 프로젝트 인수인계서 (전체 맥락)
- `docs/GPT-DIRECTOR-BRIEF.md` — GPT 첫 대화용 브리핑 (복사 붙여넣기)
- `docs/COMMUNICATION-GUIDE.md` — GPT · Cursor · 오너 소통 가이드
- `.cursor/rules/gakong-pro.mdc` — Cursor 자동 적용 개발 규칙
