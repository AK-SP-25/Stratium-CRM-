import { supabase } from './supabaseClient';

// This mirrors the get/set interface the CRM was originally built against
// (window.storage.get / window.storage.set inside a Claude artifact), so the
// rest of App.jsx didn't need to change — only where it reads/writes moved
// from the artifact sandbox to your own Supabase project.
//
// SHARED WORKSPACE MODEL: every row is stored under one fixed workspace ID
// (VITE_WORKSPACE_ID — set it to your own Supabase Auth User UID) rather
// than each signed-in user's own ID. That's deliberate: it's what makes the
// CRM a shared team tool instead of a private one — anyone you create a
// login for reads and writes the SAME data, not their own separate copy.
// Row-level security (see sql/shared_workspace.sql) still requires being
// signed in at all, so only accounts you've created can touch it.

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID;

if (!WORKSPACE_ID) {
  console.error(
    'Missing VITE_WORKSPACE_ID. Set it to your own Supabase Auth User UID ' +
    '(Authentication -> Users -> your account -> copy the User UID). ' +
    'See the README and sql/shared_workspace.sql.'
  );
}

async function assertSignedIn() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
}

export const storage = {
  async get(key) {
    await assertSignedIn();
    const { data, error } = await supabase
      .from('crm_kv')
      .select('value')
      .eq('user_id', WORKSPACE_ID)
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // App.jsx expects value as a JSON string, same as the artifact's window.storage did.
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    await assertSignedIn();
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const { error } = await supabase
      .from('crm_kv')
      .upsert(
        { user_id: WORKSPACE_ID, key, value: parsed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    if (error) throw error;
    return { key, value };
  },
};
