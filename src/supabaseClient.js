import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaces a clear error in the browser console instead of a silent blank screen
  // if the env vars weren't set in Vercel / your local .env file.
  console.error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    '(see .env.example and the README).'
  );
}

export const supabase = createClient(url, anonKey);

// Derives a display name for whoever is currently signed in — used to
// auto-attribute everything they log, instead of a manual picker. Set
// user_metadata.display_name for an account in Supabase (Authentication ->
// Users -> edit user -> User Metadata, e.g. {"display_name":"Abdulla Khan"})
// for a proper name; otherwise it's derived from the email as a fallback.
export async function currentConsultantName() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Unknown';
  const meta = user.user_metadata || {};
  if (meta.display_name) return meta.display_name;
  const local = (user.email || '').split('@')[0];
  if (!local) return 'Unknown';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
