import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types/database';

interface ImpersonationData {
  userId: string;
  companyName: string;
  userName: string;
  role: string;
}

interface AvailableCompany {
  user_id: string;
  company_id: string;
  company_name: string;
  company_logo: string | null;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  isImpersonating: boolean;
  impersonationData: ImpersonationData | null;
  isMultiCompanyManager: boolean;
  availableCompanies: AvailableCompany[];
  signIn: (emailOrDni: string, password: string) => Promise<AvailableCompany[] | void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  startImpersonation: (userId: string, companyName: string) => Promise<void>;
  stopImpersonation: () => void;
  switchCompany: (userId: string, companyId: string) => Promise<void>;
  loadAvailableCompanies: (dni: string) => Promise<AvailableCompany[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_CACHE_KEY = 'user_profile_cache';
const SESSION_CACHE_KEY = 'session_cache';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedUserData {
  user: User;
  supabaseUser: SupabaseUser;
  timestamp: number;
  isMultiCompanyManager: boolean;
  availableCompanies: AvailableCompany[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [isMultiCompanyManager, setIsMultiCompanyManager] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<AvailableCompany[]>([]);
  const isImpersonating = impersonationData !== null;

  const cacheUserData = (userData: User, supabaseUserData: SupabaseUser, isMultiManager: boolean, companies: AvailableCompany[]) => {
    try {
      const cacheData: CachedUserData = {
        user: userData,
        supabaseUser: supabaseUserData,
        timestamp: Date.now(),
        isMultiCompanyManager: isMultiManager,
        availableCompanies: companies,
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
      const age = Date.now() - data.timestamp;

      if (age > CACHE_EXPIRY_MS) {
        localStorage.removeItem(USER_CACHE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error loading cached user data:', error);
      return null;
    }
  };

  const clearUserCache = () => {
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem(SESSION_CACHE_KEY);
  };

  const isOnline = () => {
    return navigator.onLine;
  };

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  };

  const fetchUserProfile = async (authUserId: string, supabaseUserData: SupabaseUser) => {
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

        if (error) {
          console.error('Error fetching user profile:', error);
          return null;
        }

        if (!allUsers || allUsers.length === 0) {
          return null;
        }

        userData = allUsers[0];
        localStorage.setItem('last_user_id', userData.id);
      }

      let isMultiManager = false;
      let companies: AvailableCompany[] = [];

      if (userData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userData.company_id)
          .maybeSingle();

        if (companyData) {
          const profile = { ...userData, company: companyData } as User;

          if (profile.is_multi_company_manager && profile.role === 'sst_manager') {
            companies = await loadAvailableCompanies(profile.dni);
            if (companies.length > 1) {
              isMultiManager = true;
              setIsMultiCompanyManager(true);
              setAvailableCompanies(companies);
            } else {
              setIsMultiCompanyManager(false);
              setAvailableCompanies([]);
            }
          } else {
            setIsMultiCompanyManager(false);
            setAvailableCompanies([]);
          }

          cacheUserData(profile, supabaseUserData, isMultiManager, companies);
          return profile;
        }
      }

      setIsMultiCompanyManager(false);
      setAvailableCompanies([]);
      const finalUser = userData as User;
      cacheUserData(finalUser, supabaseUserData, false, []);
      return finalUser;
    } catch (error) {
      console.error('Exception in fetchUserProfile:', error);
      setIsMultiCompanyManager(false);
      setAvailableCompanies([]);
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
        if (!isOnline()) {
          const cachedData = loadCachedUserData();
          if (cachedData && mounted) {
            setUser(cachedData.user);
            setSupabaseUser(cachedData.supabaseUser);
            setIsMultiCompanyManager(cachedData.isMultiCompanyManager);
            setAvailableCompanies(cachedData.availableCompanies);
            setLoading(false);
            return;
          }
        }

        const sessionPromise = supabase.auth.getSession();
        const { data: { session }, error } = await withTimeout(sessionPromise, 3000);

        if (error) {
          console.error('Error getting session:', error);
          const cachedData = loadCachedUserData();
          if (cachedData && mounted) {
            setUser(cachedData.user);
            setSupabaseUser(cachedData.supabaseUser);
            setIsMultiCompanyManager(cachedData.isMultiCompanyManager);
            setAvailableCompanies(cachedData.availableCompanies);
          }
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          setSupabaseUser(session.user);
          const profile = await fetchUserProfile(session.user.id, session.user);
          if (mounted && profile) {
            setUser(profile);
          }
        }
      } catch (error) {
        console.error('Exception in initAuth:', error);
        const cachedData = loadCachedUserData();
        if (cachedData && mounted) {
          setUser(cachedData.user);
          setSupabaseUser(cachedData.supabaseUser);
          setIsMultiCompanyManager(cachedData.isMultiCompanyManager);
          setAvailableCompanies(cachedData.availableCompanies);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        (async () => {
          try {
            if (session?.user && mounted) {
              setSupabaseUser(session.user);
              const profile = await fetchUserProfile(session.user.id, session.user);
              if (mounted && profile) {
                setUser(profile);
              }
            } else if (mounted) {
              setUser(null);
              setSupabaseUser(null);
              setIsMultiCompanyManager(false);
              setAvailableCompanies([]);
              clearUserCache();
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            if (mounted) {
              setUser(null);
              setIsMultiCompanyManager(false);
              setAvailableCompanies([]);
            }
          }
        })();
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadAvailableCompanies = async (dni: string): Promise<AvailableCompany[]> => {
    const { data, error } = await supabase.rpc('get_companies_for_dni', {
      user_dni: dni
    });

    if (error) {
      console.error('Error loading companies:', error);
      return [];
    }

    return data || [];
  };

  const switchCompany = async (userId: string, companyId: string) => {
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!error && userData) {
      localStorage.setItem('last_user_id', userData.id);

      if (userData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userData.company_id)
          .maybeSingle();

        if (companyData) {
          const profile = { ...userData, company: companyData } as User;
          setUser(profile);
          const companies = await loadAvailableCompanies(profile.dni);
          setAvailableCompanies(companies);
          return;
        }
      }
      setUser(userData as User);
      const companies = await loadAvailableCompanies(userData.dni);
      setAvailableCompanies(companies);
    }
  };

  const signIn = async (emailOrDni: string, password: string): Promise<AvailableCompany[] | void> => {
    let email = emailOrDni;
    let dni = emailOrDni;

    if (!emailOrDni.includes('@')) {
      console.log('Looking up DNI:', emailOrDni);
      const { data, error } = await supabase.rpc('get_email_from_dni', {
        user_dni: emailOrDni
      });

      console.log('RPC result:', { data, error });

      if (error || !data) {
        console.error('DNI lookup failed:', error);
        throw new Error('No se encontró un usuario con ese DNI. Verifica que el DNI sea correcto o contacta al administrador.');
      }

      if (data.endsWith('@internal.temp')) {
        throw new Error('Este usuario no tiene email registrado. Contacta al administrador para recuperar tu contraseña.');
      }

      email = data;
      console.log('Email found for DNI:', email);
    } else {
      const { data: userData } = await supabase
        .from('users')
        .select('dni')
        .eq('email', emailOrDni)
        .maybeSingle();

      if (userData) {
        dni = userData.dni;
      }
    }

    const { data: isMultiCompany } = await supabase.rpc('is_multi_company_dni', {
      user_dni: dni
    });

    if (isMultiCompany) {
      const companies = await loadAvailableCompanies(dni);

      if (companies.length > 1) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Contraseña incorrecta. Si olvidaste tu contraseña, usa la opción de recuperación.');
          }
          throw error;
        }

        setIsMultiCompanyManager(true);
        setAvailableCompanies(companies);
        return companies;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Credenciales incorrectas. Verifica tu usuario y contraseña, o recupera tu contraseña si la olvidaste.');
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Error during sign out:', error);
      }
    } catch (error) {
      console.warn('Exception during sign out:', error);
    } finally {
      setUser(null);
      setSupabaseUser(null);
      setRealUser(null);
      setImpersonationData(null);
      setIsMultiCompanyManager(false);
      setAvailableCompanies([]);
      localStorage.removeItem('last_user_id');
      localStorage.removeItem('onboarding_completed');
      clearUserCache();

      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  };

  const startImpersonation = async (userId: string, companyName: string) => {
    if (!user || user.role !== 'super_admin') {
      throw new Error('Solo super admins pueden impersonar');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData) {
      throw new Error('Usuario no encontrado');
    }

    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userData.company_id)
      .maybeSingle();

    if (companyError || !companyData) {
      throw new Error('Empresa no encontrada');
    }

    setRealUser(user);

    const impersonatedUser: User = {
      ...userData,
      company: companyData,
    };

    setUser(impersonatedUser);
    setImpersonationData({
      userId: userData.id,
      companyName,
      userName: userData.full_name,
      role: userData.role,
    });
  };

  const stopImpersonation = () => {
    if (realUser) {
      setUser(realUser);
      setRealUser(null);
      setImpersonationData(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      loading,
      isImpersonating,
      impersonationData,
      isMultiCompanyManager,
      availableCompanies,
      signIn,
      signOut,
      refreshUser,
      startImpersonation,
      stopImpersonation,
      switchCompany,
      loadAvailableCompanies
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
