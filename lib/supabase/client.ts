import { createClient } from '@supabase/supabase-js'

/**
 * Browser-side Supabase client using the anon key.
 * Used for reading saved reviews and collection runs after page refresh.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  })
}
