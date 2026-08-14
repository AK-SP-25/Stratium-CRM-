import { supabase } from './supabaseClient';

// This mirrors the get/set interface the CRM was originally built against
// (window.storage.get / window.storage.set inside a Claude artifact), so the
// rest of App.jsx didn't need to change — only where it reads/writes moved
// from the artifact sandbox to your own Supabase project. Every row is tied
// to auth.uid() via Postgres row-level security, so your data is only ever
// visible to your logged-in account.

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export const storage = {
  async get(key) {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from('crm_kv')
      .select('value')
      .eq('user_id', user_id)
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // App.jsx expects value as a JSON string, same as the artifact's window.storage did.
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    const user_id = await currentUserId();
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const { error } = await supabase
      .from('crm_kv')
      .upsert(
        { user_id, key, value: parsed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    if (error) throw error;
    return { key, value };
  },
};
