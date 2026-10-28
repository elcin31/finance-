import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function validConfiguration(): boolean {
  if (!url || !publishableKey || publishableKey.length < 16) return false;
  // Secret/service-role credentials must never be used as browser configuration.
  if (publishableKey.startsWith('sb_secret_')) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
    );
  } catch {
    return false;
  }
}

export const configured = validConfiguration();
export const supabase: SupabaseClient | null = configured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
