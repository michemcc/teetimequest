/**
 * TeeTimeQuest — Supabase client
 *
 * Single shared instance. Import this wherever you need Supabase:
 *   import { supabase } from './supabase'
 *
 * Env vars (set in .env.local and Vercel → Settings → Environment Variables):
 *   VITE_SUPABASE_URL      — Project URL from Supabase → Settings → API
 *   VITE_SUPABASE_ANON_KEY — anon/public key (not service_role)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[TeeTimeQuest] Supabase env vars missing. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
  )
}

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // No user auth in this app — we use anonymous access with RLS
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)
