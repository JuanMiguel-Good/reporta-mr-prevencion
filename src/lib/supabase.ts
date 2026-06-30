import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase.');
}

const COOKIE_DOMAIN = '.mrprevencion.app';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 días en segundos

function setCookie(name: string, value: string) {
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; domain=${COOKIE_DOMAIN}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function removeCookie(name: string) {
  document.cookie = `${name}=; domain=${COOKIE_DOMAIN}; path=/; max-age=0; SameSite=Lax; Secure`;
}

const cookieStorage = {
  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null;
    return getCookie(key);
  },
  setItem(key: string, value: string): void {
    if (typeof document === 'undefined') return;
    setCookie(key, value);
  },
  removeItem(key: string): void {
    if (typeof document === 'undefined') return;
    removeCookie(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? cookieStorage : undefined,
    storageKey: 'mr-prevencion-auth',
    flowType: 'implicit',
  },
});

export type UserRole = 'superadmin' | 'prevencionista' | 'trabajador';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  dni: string | null;
  phone: string | null;
  company_id: string | null;
  subscription_status: 'active' | 'trial' | 'expired' | 'cancelled' | null;
  subscription_end: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  ruc: string | null;
  contact_email: string | null;
  logo_url: string | null;
  status: 'active' | 'suspended' | 'pending';
}
