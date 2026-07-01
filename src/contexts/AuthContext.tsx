import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../lib/supabase';

// The app-level user combines auth identity with profile data.
// Fields absent from the central `profiles` table (area, proyecto,
// can_close_reports, active) will be undefined — callers treat them as falsy.
export type AppUser = Profile & {
  auth_user_id: string;
  email: string | null;
  active?: boolean;
  area?: string | null;
  proyecto?: string | null;
  can_close_reports?: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isSstManager: boolean;
  isHrObserver: boolean;
  isWorker: boolean;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (supabaseUser: SupabaseUser): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, company_id, subscription_status, subscription_end, role, full_name, dni')
        .eq('id', supabaseUser.id)
        .single();
      if (!error && data) {
        const roleMap: Record<string, string> = {
          trabajador: 'worker',
          prevencionista: 'sst_manager',
          superadmin: 'sst_manager',
        };
        const mappedRole = roleMap[data.role as string] ?? data.role;
        setProfile({ ...data, role: mappedRole } as Profile);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await loadProfile(currentUser);
      }
    } catch {
      // profile stays as-is
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000);

        if (!mounted) return;

        if (session?.user) {
          setAuthUser(session.user);
          await loadProfile(session.user);
        } else {
          setAuthUser(null);
          setProfile(null);
        }
      } catch {
        if (mounted) {
          setAuthUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        try {
          if (session?.user) {
            setAuthUser(session.user);
            await loadProfile(session.user);
          } else {
            setAuthUser(null);
            setProfile(null);
          }
        } catch {
          if (mounted) {
            setAuthUser(null);
            setProfile(null);
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout warning:', err);
    } finally {
      setAuthUser(null);
      setProfile(null);
    }
  };

  const role = profile?.role ?? null;
  const isSuperAdmin = role === 'super_admin';
  const isSstManager = role === 'sst_manager';
  const isHrObserver = role === 'hr_observer';
  const isWorker = role === 'worker';
  const isManager = isSuperAdmin || isSstManager;

  // Build unified app user merging auth identity + profile
  const user: AppUser | null = profile && authUser
    ? {
        ...profile,
        auth_user_id: authUser.id,
        email: authUser.email ?? null,
      }
    : null;

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading,
      isSuperAdmin, isSstManager, isHrObserver,
      isManager, isWorker,
      signIn, signOut, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}
