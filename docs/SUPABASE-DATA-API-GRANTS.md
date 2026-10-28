# Supabase Data API 명시적 권한

2026-10-30부터 기존 프로젝트의 `public`에 새로 생성되는 테이블도 자동 Data API 권한에 의존할 수 없다. 기존 객체의 ACL은 유지된다. 이 저장소는 테이블 생성 SQL에 앱이 사용하는 `authenticated` 권한을 명시한다. RLS·정책은 별도 접근 제어이며 계속 필요하다.

## 반영 범위

`schema.sql`, `002_deliveries.sql`, `003_full_mvp.sql`, 대체 경로인 `003_work_orders_minimal.sql`, `006_print_templates.sql`에 GRANT를 포함한다. `004`, `005`, `007`, `008`의 컬럼·인덱스 변경은 기존 테이블 ACL을 바꾸지 않는다.

| 테이블 | authenticated 권한 |
| --- | --- |
| customers, vendors, items, bom_items, orders, deliveries, work_orders, production_logs, print_templates | SELECT, INSERT, UPDATE, DELETE |
| delivery_items | SELECT, INSERT, DELETE |
| process_logs | SELECT, INSERT |
| process_steps, defect_types, setup_types, surface_treatments | SELECT, INSERT, UPDATE |
| company_settings | SELECT, UPDATE |
| users_profile | 신규 API 권한 보류: 현재 서비스에서 미사용 |

`public` 스키마 USAGE도 `authenticated`에 명시한다. anon/service_role에는 새 권한을 추가하지 않는다. UUID 기본값에는 시퀀스 권한이 필요하지 않다. 서버 Data API 작업이나 프로필 기능을 추가하면 그 변경에서 권한을 다시 검토한다.

이 GRANT는 기존의 더 넓은 권한을 회수하지 않는다. 새 환경에서도 기본 ACL·역할 상속으로 추가 권한이 생길 수 있다. 현재 RLS의 `USING (true)`는 로그인 사용자 간 행 격리를 제공하지 않으며, 이 변경은 사용자·회사별 권한 설계 변경을 포함하지 않는다.

## 기존 프로젝트

1. 실제 `VITE_SUPABASE_URL`의 project ref를 확인한다.
2. SQL Editor에서 `supabase/checks/data_api_privileges.sql`을 실행한다. 읽기 전용이며 누락 테이블과 권한 부족을 구분한다.
3. 정상인 기존 테이블은 변경하지 않는다. 과거 SQL 파일을 수정해도 이미 적용한 DB가 자동 갱신되지는 않는다.
4. 있는 테이블의 필수 권한 누락이 확인된 경우에만 해당 객체의 좁은 GRANT를 후속 마이그레이션으로 적용한다. RLS와 정책을 먼저 확인하고 기존 ACL을 보존한다. 권한만 보강하려고 전체 스키마나 seed 포함 마이그레이션을 재실행하지 않는다.
5. `print_templates`가 없으면 GRANT만으로 해결할 수 없다. 필요 시 수정된 `006`과 `007`을 검토해 생성한다. 생성·RLS·정책·GRANT는 같은 트랜잭션으로 실행한다.

예: 이미 있는 출력 양식 테이블의 권한 보강이 필요한 경우에만 소유자 역할로 실행:

```sql
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.print_templates TO authenticated;
COMMIT;
```

이번 소스 반영은 운영 DB에 이 SQL을 실행하거나 누락 테이블을 생성하지 않는다. 모든 public 객체에 대한 일괄 GRANT/REVOKE 및 ALTER DEFAULT PRIVILEGES도 실행하지 않는다.

## 신규 생성·복구

- 빈 테스트 프로젝트에서는 최신 `schema.sql`을 기준 스키마로 한 번 적용하고 테이블·컬럼·정책·트리거를 검증한다. 중복 실행은 지원하지 않는다. 기본 설정 seed는 필요 항목을 별도로 검토한다.
- 증분 복구는 해당 버전의 초기 스키마가 준비된 상태에서 `002 → 003_full_mvp → 004 → 005 → 006 → 007 → 008` 순서다. `003_work_orders_minimal`은 대체 경로다.
- `npm run db:migrate`는 현재 **002~005만 실행**한다. 006~008까지 적용됐다고 판단하지 않는다.
- 루트 `supabase/schema.sql`은 CLI가 자동 재생하는 migrations 안의 초기 baseline이 아니다. CLI `db reset` 사용 전 baseline과 중복 003 및 적용 이력을 먼저 정리하고 격리 환경에서 검증한다. 운영에는 reset을 실행하지 않는다.
- 기존 객체에 `ALTER ADD COLUMN` 또는 `CREATE TABLE IF NOT EXISTS`가 수행되면 ACL은 그대로다. DROP/CREATE나 빈 DB 재구축은 새 객체이므로 명시적 GRANT가 필요하다.
- ACL을 포함한 백업 복구는 그 권한이 정상 복원되는지 확인한다. `--no-acl`/`--no-privileges` 또는 데이터만 복구하는 경로는 대상 권한에 의존한다. 관리형 백업/PITR은 마이그레이션 재생과 구분해 실제 복원 결과를 확인한다.
- 스키마 자체를 재생성하면 USAGE와 Data API enabled/exposed schemas도 점검한다. 기본 ACL은 객체 생성 역할별이므로 특정 역할 하나만 확인해서는 충분하지 않다.

## 검증·되돌리기

읽기 전용 SQL로 객체 존재, 유효 권한, ACL, RLS, 정책, 기본 ACL을 확인한다. 그다음 자동 GRANT가 없는 격리 환경에서 로그인한 테스트 사용자로 필요한 CRUD를 실행하고 다시 조회한다. anon 요청은 업무 데이터에 접근하지 못해야 한다. 쓰기 테스트는 운영 데이터에 실행하지 않는다.

`scripts/check-supabase.mjs`는 anon 요청이므로 authenticated 기능의 충분한 검증이 아니다. `scripts/check-auth.mjs`는 실제 orders INSERT/UPDATE/DELETE를 하므로 읽기 전용 점검용이 아니다.

출력 양식 코드는 `print_templates`가 포함된 오류 메시지를 테이블 없음으로 오인할 수 있다. 화면에 기본 양식이 보이는 것만으로 성공 처리하지 말고 실제 API 응답의 `error.code`와 저장·재조회를 확인한다. 앱의 오류 처리 수정은 별도 작업이다.

42501은 테이블·스키마·컬럼·시퀀스 권한 또는 RLS 거부를 구분한다. PGRST205는 객체 존재·노출 스키마·캐시를 확인한다. service_role 성공을 authenticated 성공으로 간주하지 않는다.

COMMIT 전에는 ROLLBACK한다. 적용 후 되돌리기는 변경 전 ACL과 비교해 이번에 추가된 권한만 제거한다. 일괄 REVOKE를 사용하지 않는다. 소스 변경 자체는 해당 커밋을 되돌릴 수 있다.

공식 근거: [변경 안내](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [API 보안](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).
