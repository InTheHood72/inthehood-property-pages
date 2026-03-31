import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key
// This bypasses Row Level Security (RLS) and should only be used in server components
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('[Supabase Server] URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('[Supabase Server] Service Key:', supabaseServiceKey ? `SET (${supabaseServiceKey.substring(0, 20)}...)` : 'MISSING');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for server-side client');
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
