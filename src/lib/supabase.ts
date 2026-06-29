import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'mr-prevencion-auth',
    flowType: 'pkce',
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
