# 가공관리 Pro — 프로젝트 인수인계서

> GPT 총감독 · 프로젝트 오너 · Cursor 개발자 공용 문서  
> 최종 갱신: 2026-06-12 | 현재 단계: **1차 기본 틀 완료**

---

## 1. 역할 분담

| 역할 | 담당 | 책임 |
|------|------|------|
| **GPT (총감독)** | 기획·우선순위·요구사항·검수 | 다음 작업 지시서 작성, 범위 통제 |
| **Cursor (실행 개발)** | 코드 구현·실행·디버깅 | GPT 지시서를 코드로 반영 |
| **오너 (사용자)** | 최종 결정·테스트·승인 | 지시 전달, 결과 검수 |

### 권장 소통 흐름

```
오너 → GPT: "다음에 뭘 만들지?"
GPT → 오너: 작업 지시서 (목표·파일·요구·금지·완료기준)
오너 → Cursor: 지시서 붙여넣기 + "구현해줘"
Cursor → 오너: 구현 완료 보고
오너 → GPT: 결과 보고 + 이슈
GPT → 오너: 검수 + 다음 지시
```

---

## 2. 서비스 개요

- **서비스명**: 가공관리 Pro
- **정의**: 금속가공업체 사무실에서 수주 접수, 공정이동표, 생산일보, 납품까지 관리하는 웹 기반 미니 ERP
- **기술 스택**: React 19 + TypeScript + Vite 8 + Supabase (Auth + PostgreSQL)
- **배포 예정**: Vercel
- **UI 방향**: PC 업무용, 좌측 고정 메뉴(230px) + 우측 헤더/콘텐츠, 네이비/블루그레이, 14px 기본

---

## 3. 운영 현황 (1차 완료 시점)

| 항목 | 상태 |
|------|------|
| Supabase 프로젝트 ref | `myhujwvcrdzamsxwxeff` |
| DB 스키마 (`schema.sql`) | ✅ 적용 완료 |
| 환경변수 (`.env`) | ✅ 로컬 설정 완료 |
| 테스트 로그인 계정 | ✅ `test@test.com` (비밀번호는 별도 관리) |
| 로컬 실행 | `npm run dev` → http://localhost:5173/ |
| 연결 점검 | `node scripts/check-supabase.mjs` |

### 환경변수 (`.env`)

```
VITE_SUPABASE_URL=https://myhujwvcrdzamsxwxeff.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...  (프론트용 공개 키)
```

> `service_role` 키, DB 비밀번호는 절대 Git/채팅에 올리지 않음.

---

## 4. 구현 완료 (1차)

| 메뉴 | 경로 | 기능 |
|------|------|------|
| 로그인 | `/login` | Supabase 이메일/비밀번호 |
| 대시보드 | `/` | 통계 카드 + 최근 수주 |
| 수주관리 | `/orders` | CRUD, 품목 연동, 금액 자동계산, 필터 |
| 고객사 | `/customers` | CRUD, 검색 |
| 매입업체 | `/vendors` | CRUD, 검색, 구분(소재/후처리 등) |
| 품목/BOM | `/items` | 품목 CRUD + 선택 품목 BOM 하위 관리 |

### 공통 구현 사항

- 미로그인 시 ERP 접근 차단 (`ProtectedRoute`)
- `created_by` / `updated_by`에 로그인 이메일 기록
- 삭제 시 `confirm`, 에러 알림, 빈 상태 UI
- 활성 메뉴·선택 행 시각적 강조

---

## 5. 미구현 (placeholder만 존재)

| 메뉴 | 경로 | 상태 |
|------|------|------|
| 작업지시 | `/work-orders` | "다음 단계에서 구현 예정" 안내 |
| 생산관리 | `/production` | 동일 |
| 생산일보 | `/production-log` | 동일 |
| 납품관리 | `/delivery` | 동일 |
| 설정 | `/settings` | 동일 |
| 거래명세표 출력 | — | 미구현 |
| 공정이동표 출력 | — | 미구현 |
| users_profile 자동 생성 | — | 테이블만 존재 |
| 역할 기반 권한 | — | 미구현 |

---

## 6. 코드 구조

```
gakong-pro/
├── src/
│   ├── pages/              # 화면 단위
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── VendorsPage.tsx
│   │   ├── ItemsPage.tsx
│   │   ├── OrdersPage.tsx
│   │   └── PlaceholderPage.tsx
│   ├── services/           # Supabase CRUD (DB 연동)
│   │   ├── customers.ts
│   │   ├── vendors.ts
│   │   ├── items.ts
│   │   ├── orders.ts
│   │   └── dashboard.ts
│   ├── types/index.ts      # 전체 타입 정의
│   ├── lib/
│   │   ├── supabase.ts     # Supabase 클라이언트
│   │   └── constants.ts    # 메뉴, 상태값 enum
│   ├── components/
│   │   ├── layout/         # Sidebar, Header, AppLayout
│   │   ├── ui/             # Modal, Badge, EmptyState
│   │   └── auth/           # ProtectedRoute
│   ├── contexts/AuthContext.tsx
│   ├── App.tsx             # 라우팅
│   ├── main.tsx
│   └── index.css           # 전역 스타일 (CSS 변수)
├── supabase/schema.sql     # DB 스키마 (단일 진실 소스)
├── scripts/
│   ├── check-supabase.mjs  # 테이블·연결 점검
│   └── apply-schema.mjs    # DB 비밀번호로 스키마 자동 적용
├── .env                    # 로컬 환경변수 (git 제외)
├── .env.example
├── HANDOFF.md              # 이 문서
└── README.md
```

### 레이어 규칙

- **pages**: UI + 폼 상태 + 서비스 호출
- **services**: Supabase 쿼리만 (비즈니스 로직 최소화)
- **types**: DB 테이블과 1:1 타입
- **lib/constants.ts**: 메뉴, enum 값 (화면·DB 공통 기준)

---

## 7. DB 스키마 요약

| 테이블 | 용도 |
|--------|------|
| `users_profile` | 사용자 프로필 (1차: 미연동) |
| `customers` | 고객사 |
| `vendors` | 매입업체 |
| `items` | 품목 (customer_id FK) |
| `bom_items` | BOM 상세 (parent_item_id FK, CASCADE 삭제) |
| `orders` | 수주 (customer_id, item_id FK) |

### 주요 enum 값 (`src/lib/constants.ts`)

**매입업체 구분**: 소재, 후처리, 외주가공, 구매품, 기타  
**품목 유형**: ASSY, 단품, 구매품, 가공품, 사급품  
**수주상태**: 접수, 보류, 취소, 부분납품, 납기지연, 출하대기, 납품완료  
**공정상태**: 수주접수, 도면배포, 생산, 후처리, 출하검사, 출하대기

### RLS 정책 (1차)

- 모든 테이블: `authenticated` 사용자 전체 접근
- 향후 역할 기반으로 세분화 예정

---

## 8. 다음 단계 권장 순서

1. **납품관리** — `orders.delivered_quantity` / `remaining_quantity` 연동
2. **생산일보** — 일별 생산 실적 기록 테이블·화면
3. **생산관리 / 작업지시** — `process_status` 흐름 관리
4. **공정이동표 출력** — 수주·공정 데이터 기반 인쇄/PDF
5. **거래명세표 출력** — 납품 완료 건 문서 출력
6. **설정** — 사용자 관리, 권한, 기본값

---

## 9. GPT 총감독 — Cursor 지시서 템플릿

새 기능 지시 시 아래 형식을 사용하세요.

```markdown
## [기능명] 구현 지시

### 1. 목표
(한 문장)

### 2. 생성/수정 파일
- src/pages/...
- src/services/...
- supabase/schema.sql (테이블 추가 시)

### 3. 화면 요구사항
- 목록 컬럼: ...
- 등록/수정 필드: ...
- 검색/필터: ...

### 4. DB 요구사항
- 신규 테이블/컬럼: ...
- 기존 테이블 연동: ...

### 5. 하지 말 것
- 1차 범위 밖 기능 추가 금지
- unrelated 파일 수정 금지

### 6. 완료 기준 (테스트 체크리스트)
- [ ] 로그인 후 메뉴 접근
- [ ] CRUD 동작
- [ ] 빈 상태·에러 처리
- [ ] npm run build 성공
```

---

## 10. 진행 보고 템플릿 (오너 → GPT)

```markdown
## 진행 보고 — [날짜]

### 완료
- ...

### 이슈 / 버그
- ...

### 변경 파일
- ...

### 스크린샷 / 동작 설명
- ...

### 질문
- 다음 우선순위 확인 요청
```

---

## 11. 개발 원칙 (모든 단계 공통)

1. 한 파일에 모든 코드를 넣지 않는다
2. DB 연동은 `services/`, 타입은 `types/`, Supabase 클라이언트는 `lib/supabase.ts`
3. 범위 밖 기능을 임의로 추가하지 않는다
4. 삭제는 confirm, 에러는 사용자 알림, 빈 데이터는 EmptyState
5. 디자인: 14px 본문, 네이비 사이드바, 활성 메뉴·선택 행 반전 강조
6. Supabase anon/publishable key만 프론트에 사용

---

## 12. 관련 문서

- `docs/GPT-DIRECTOR-BRIEF.md` — GPT 첫 대화용 짧은 브리핑 (복사 붙여넣기)
- `docs/COMMUNICATION-GUIDE.md` — 3자 소통 가이드
- `.cursor/rules/gakong-pro.mdc` — Cursor 자동 적용 개발 규칙
