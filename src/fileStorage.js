import { supabase } from './supabaseClient';

// Wraps Supabase Storage for candidate CV files. Every file lives under
// "<your_user_id>/<candidateId>/<filename>" in the private "candidate-cvs"
// bucket (see sql/storage_setup.sql) — RLS on storage.objects means only
// your own account can ever list, read, or delete these, same privacy model
// as the crm_kv table.

const BUCKET = 'candidate-cvs';

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

function safeName(name) {
  return name.replace(/[^\w.\-]/g, '_');
}

export const fileStorage = {
  // Uploads a File/Blob for a candidate. Returns the stored path — save this
  // on the candidate record so you can fetch or delete it later.
  async upload(candidateId, file) {
    const userId = await currentUserId();
    const path = `${userId}/${candidateId}/${Date.now()}_${safeName(file.name || 'file')}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  },

  // Returns a temporary signed URL (1 hour) to view/download a stored file.
  async getUrl(path) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async remove(path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  },
};
