import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types/database';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_CACHE_KEY = 'user_profile_cache';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedUserData {
  user: User;
  supabaseUser: SupabaseUser;
  timestamp: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const cacheUserData = (userData: User, supabaseUserData: SupabaseUser) => {
    try {
      const cacheData: CachedUserData = {
        user: userData,
        supabaseUser: supabaseUserData,
        timestamp: Date.now(),
      };
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching user data:', error);
    }
  };

  const loadCachedUserData = (): CachedUserData | null => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      if (!cached) return null;

      const data: CachedUserData = JSON.parse(cached);
      if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
        localStorage.removeItem(USER_CACHE_KEY);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  };

  const clearUserCache = () => {
    localStorage.removeItem(USER_CACHE_KEY);
  };

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  };

  const fetchUserProfile = async (authUserId: string, supabaseUserData: SupabaseUser): Promise<User | null> => {
    try {
      const lastUserId = localStorage.getItem('last_user_id');
      let userData = null;

      if (lastUserId) {
        const result = await supabase
          .from('users')
          .select('*')
          .eq('id', lastUserId)
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        userData = result.data;
      }

      if (!userData) {
        const { data: allUsers, error } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId);

        if (error || !allUsers || allUsers.length === 0) return null;

        userData = allUsers[0];
        localStorage.setItem('last_user_id', userData.id);
      }

      if (userData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userData.company_id)
          .maybeSingle();

        if (companyData) {
          const profile = { ...userData, company: companyData } as User;
          cacheUserData(profile, supabaseUserData);
          return profile;
        }
      }

      const finalUser = userData as User;
      cacheUserData(finalUser, supabaseUserData);
      return finalUser;
    } catch (error) {
      console.error('Exception in fetchUserProfile:', error);
      return null;
    }
  };

  const refreshUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const profile = await fetchUserProfile(authUser.id, authUser);
      setUser(profile);
      setSupabaseUser(authUser);
    } else {
      setUser(null);
      setSupabaseUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        if (!navigator.onLine) {
          const cachedData = loadCachedUserData();
          if (cachedData && mounted) {
            setUser(cachedData.user);
            setSupabaseUser(cachedData.supabaseUser);
            setLoading(false);
            return;
          }
        }

        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 3000);

        if (error) {
          const cachedData = loadCachedUserData();
          if (cachedData && mounted) {
            setUser(cachedData.user);
            setSupabaseUser(cachedData.supabaseUser);
          }
          if (mounted) setLoading(false);
          return;
        }

        if (session?.user && mounted) {
          setSupabaseUser(session.user);
          const profile = await fetchUserProfile(session.user.id, session.user);
          if (mounted && profile) setUser(profile);
        }
      } catch {
        const cachedData = loadCachedUserData();
        if (cachedData && mounted) {
          setUser(cachedData.user);
          setSupabaseUser(cachedData.supabaseUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        try {
          if (session?.user && mounted) {
            setSupabaseUser(session.user);
            const profile = await fetchUserProfile(session.user.id, session.user);
            if (mounted && profile) setUser(profile);
          } else if (mounted) {
            setUser(null);
            setSupabaseUser(null);
            clearUserCache();
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          if (mounted) setUser(null);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Credenciales incorrectas. Verifica tu email y contraseña, o recupera tu contraseña si la olvidaste.');
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Exception during sign out:', error);
    } finally {
      setUser(null);
      setSupabaseUser(null);
      localStorage.removeItem('last_user_id');
      localStorage.removeItem('onboarding_completed');
      clearUserCache();

      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  }
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
