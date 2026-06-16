import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  DEV_LOGIN_EMAIL,
  DEV_LOGIN_PASSWORD,
  DEV_USER_EMAIL,
  SKIP_AUTH,
} from '../lib/authConfig';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  userEmail: string;
  skipAuth: boolean;
  devAuthError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [devAuthError, setDevAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (SKIP_AUTH) {
      let cancelled = false;

      (async () => {
        const { data: existingSession } = await supabase.auth.getSession();
        if (cancelled) return;

        if (existingSession.session) {
          setSession(existingSession.session);
          setUser(existingSession.session.user);
          setDevAuthError(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: DEV_LOGIN_EMAIL,
          password: DEV_LOGIN_PASSWORD,
        });

        if (cancelled) return;

        if (error) {
          setDevAuthError(
            `개발 자동 로그인 실패: ${error.message}\n(DB 저장이 안 될 수 있습니다)`,
          );
          setUser(null);
          setSession(null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setDevAuthError(null);
        }
        setLoading(false);
      })();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, s) => {
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (SKIP_AUTH) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const userEmail = user?.email ?? (SKIP_AUTH ? DEV_USER_EMAIL : '');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        userEmail,
        skipAuth: SKIP_AUTH,
        devAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
