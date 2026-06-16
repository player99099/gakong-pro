import pg from 'pg';

export function getProjectRef(env = process.env) {
  const url = env.VITE_SUPABASE_URL ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? 'myhujwvcrdzamsxwxeff';
}

/** Supabase Postgres — pooler·직접 연결 후보 순차 시도 */
export async function connectSupabasePg(password, env = process.env) {
  const ref = getProjectRef(env);
  const encoded = encodeURIComponent(password);
  const user = `postgres.${ref}`;

  const candidates = [
    {
      label: 'pooler:6543 (transaction)',
      connectionString: `postgresql://${user}:${encoded}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`,
    },
    {
      label: 'pooler:5432 (session)',
      connectionString: `postgresql://${user}:${encoded}@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`,
    },
    {
      label: 'direct:5432',
      connectionString: `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`,
    },
  ];

  const errors = [];

  for (const { label, connectionString } of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    try {
      await client.connect();
      return { client, label };
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }

  throw new Error(
    `DB 연결 실패 (비밀번호·리전 확인)\n${errors.join('\n')}`,
  );
}
