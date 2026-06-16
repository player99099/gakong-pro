/** Supabase PostgrestError 등 — 기술용 전체 메시지 (중복 enrich 방지) */
export function formatTechnicalError(err: unknown): string {
  if (err == null) return '알 수 없는 오류';
  if (typeof err === 'string') return err;

  const parts: string[] = [];

  if (err instanceof Error && err.message) {
    parts.push(err.message);
  }

  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (!parts.length && o.message != null) {
      parts.push(String(o.message));
    }
    if (o.details) parts.push(`상세: ${String(o.details)}`);
    if (o.hint) parts.push(`힌트: ${String(o.hint)}`);
    if (o.code) parts.push(`코드: ${String(o.code)}`);
  }

  if (parts.length === 0) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return parts.join('\n');
}

export type UploadErrorKind = 'system' | 'excel' | 'unknown';

export interface UserUploadError {
  kind: UploadErrorKind;
  userMessage: string;
  technicalDetail?: string;
}

function appendAdminHintOnce(message: string, hint: string): string {
  if (message.includes(hint)) return message;
  return `${message}\n\n${hint}`;
}

/** 업로드 화면용 — 현업 사용자 메시지와 관리자용 기술 정보 분리 */
export function resolveUserUploadError(err: unknown): UserUploadError {
  const technical = formatTechnicalError(err).trim();
  const lower = technical.toLowerCase();

  if (
    lower.includes('schema cache') ||
    /could not find the '(\w+)' column/.test(lower)
  ) {
    const colMatch = lower.match(/could not find the '(\w+)' column/);
    const col = colMatch?.[1] ?? '필수';
    return {
      kind: 'system',
      userMessage:
        `서버 DB에 orders.${col} 컬럼이 없어 저장할 수 없습니다.\n\n` +
        '시스템 관리자에게 DB 마이그레이션을 요청해 주세요.\n' +
        '(npm run db:migrate:orders 또는 Supabase SQL Editor에서 005 실행)',
      technicalDetail: appendAdminHintOnce(
        technical,
        '[관리자] supabase/migrations/005_orders_required_columns.sql 실행 후 npm run db:check 로 확인',
      ),
    };
  }

  if (
    lower.includes('seq_no') &&
    (lower.includes('does not exist') || lower.includes('column'))
  ) {
    return {
      kind: 'system',
      userMessage:
        '서버 설정이 완료되지 않아 업로드를 진행할 수 없습니다.\n\n' +
        '시스템 관리자에게 「수주 순번(seq_no) DB 연동」 설정을 요청해 주세요.\n' +
        '(엑셀 파일을 수정해도 해결되지 않습니다)',
      technicalDetail: appendAdminHintOnce(
        technical,
        '[관리자] Supabase SQL Editor에서 migration 004(orders.seq_no) 실행',
      ),
    };
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return {
      kind: 'system',
      userMessage:
        '서버에 연결할 수 없습니다.\n\n인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요.',
      technicalDetail: technical,
    };
  }

  if (lower.includes('jwt') || lower.includes('not authenticated')) {
    return {
      kind: 'system',
      userMessage: '로그인이 만료되었습니다.\n\n로그아웃 후 다시 로그인해 주세요.',
      technicalDetail: technical,
    };
  }

  if (lower.includes('permission denied') || lower.includes('row-level security')) {
    return {
      kind: 'system',
      userMessage:
        '데이터 접근 권한이 없습니다.\n\n시스템 관리자에게 orders 테이블 접근 권한을 요청해 주세요.',
      technicalDetail: technical,
    };
  }

  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    const isExcelHint =
      msg.includes('엑셀') ||
      msg.includes('행') ||
      msg.includes('열') ||
      msg.includes('순번') ||
      msg.includes('형식 설정') ||
      msg.includes('시트') ||
      msg.includes('헤더');

    return {
      kind: isExcelHint ? 'excel' : 'unknown',
      userMessage: msg,
      technicalDetail: technical !== msg ? technical : undefined,
    };
  }

  return {
    kind: 'unknown',
    userMessage: technical || '알 수 없는 오류가 발생했습니다.',
    technicalDetail: undefined,
  };
}

const DB_MIGRATE_HINT =
  'Supabase SQL Editor에서 supabase/migrations/003_work_orders_minimal.sql 실행\n' +
  '(전체 MVP: 003_full_mvp.sql)\n' +
  '또는 .env에 SUPABASE_DB_PASSWORD 설정 후: npm run db:migrate:003';

/** 작업지시·생산 등 MVP 테이블 미적용 시 사용자 안내 */
export function resolveWorkOrderPageError(
  err: unknown,
  fallback: string,
): string {
  const technical = formatTechnicalError(err).trim();
  const lower = technical.toLowerCase();

  if (
    lower.includes('work_orders') &&
    (lower.includes('schema cache') ||
      lower.includes('does not exist') ||
      lower.includes('pgrst205'))
  ) {
    return (
      '작업지시 DB 테이블(work_orders)이 아직 없습니다.\n\n' +
      '시스템 관리자에게 아래 중 하나를 요청해 주세요.\n' +
      `· ${DB_MIGRATE_HINT}\n` +
      '· npm run db:check 로 work_orders ✅ 확인'
    );
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';
  }

  if (lower.includes('jwt') || lower.includes('not authenticated')) {
    return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  }

  return technical || fallback;
}

const PRINT_TEMPLATES_MIGRATE_FILE = 'supabase/migrations/006_print_templates.sql';

/** 출력 양식 저장·조회 실패 시 사용자 안내 */
export function resolvePrintTemplateSaveError(
  err: unknown,
  fallback: string,
): string {
  const technical = formatTechnicalError(err).trim();
  const lower = technical.toLowerCase();

  if (
    lower.includes('print_templates') &&
    (lower.includes('schema cache') ||
      lower.includes('does not exist') ||
      lower.includes('pgrst205'))
  ) {
    return (
      '출력 양식 DB 테이블(print_templates)이 아직 없습니다.\n\n' +
      'Supabase SQL Editor에서 아래 파일을 실행해 주세요.\n' +
      `· ${PRINT_TEMPLATES_MIGRATE_FILE}\n\n` +
      '실행 후: npm run db:check → print_templates ✅'
    );
  }

  if (
    lower.includes('row-level security') ||
    lower.includes('rls') ||
    lower.includes('violates row-level security')
  ) {
    return (
      '출력 양식을 저장할 권한이 없습니다.\n\n' +
      '로그인 상태를 확인해 주세요.\n' +
      '(개발 모드: Supabase Authentication에 VITE_DEV_LOGIN_EMAIL 계정 등록)'
    );
  }

  if (lower.includes('jwt') || lower.includes('not authenticated')) {
    return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';
  }

  return technical || fallback;
}

/** @deprecated — resolveUserUploadError 사용 권장 */
export function formatAppError(err: unknown): string {
  return resolveUserUploadError(err).userMessage;
}

export function formatAppErrorWithContext(
  context: string,
  err: unknown,
): string {
  const detail = formatTechnicalError(err);
  return `[${context}] ${detail}`;
}
