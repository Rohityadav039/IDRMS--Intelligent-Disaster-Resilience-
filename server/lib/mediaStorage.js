// =========================================================================
// IDRMS Media Storage Helper
// Uploads photos (sponsor equipment proof, landslide ground reports,
// citizen field reports) to Supabase Storage when configured. Falls back
// to writing the file to local disk (public/uploads/<folder>/) so the app
// keeps working with zero Supabase setup, exactly like the rest of db.js.
//
// ASSUMPTION: bucket is public-read (fine for disaster-alert imagery that
// needs to be viewable on dashboards without auth). If you need private
// media, switch to createSignedUrl() and adjust the frontend accordingly.
// =========================================================================
const fs = require('fs');
const path = require('path');
const { getSupabase, isSupabaseConfigured } = require('../supabaseClient');

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'idrms-media';

// Ensure a local fallback directory exists
function ensureLocalDir(folder) {
  const dir = path.join(__dirname, '..', '..', 'public', 'uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Upload an in-memory file buffer (from multer memoryStorage) to Supabase
 * Storage, or to local disk if Supabase Storage is not configured/reachable.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer     - raw file bytes
 * @param {string} params.folder     - logical sub-folder, e.g. 'equipment' | 'reports' | 'field'
 * @param {string} params.filename   - desired filename (should already be unique)
 * @param {string} params.mimetype   - e.g. 'image/jpeg'
 * @returns {Promise<{url: string, storage: 'SUPABASE'|'LOCAL_DISK', path: string}>}
 */
async function uploadMedia({ buffer, folder, filename, mimetype }) {
  const storagePath = `${folder}/${filename}`;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      const { error: uploadError } = await supabase
        .storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimetype || 'image/jpeg',
          upsert: false
        });

      if (!uploadError) {
        const { data: publicData } = supabase
          .storage
          .from(MEDIA_BUCKET)
          .getPublicUrl(storagePath);

        if (publicData && publicData.publicUrl) {
          return { url: publicData.publicUrl, storage: 'SUPABASE', path: storagePath };
        }
      } else {
        console.warn(`Supabase Storage upload error (bucket '${MEDIA_BUCKET}'):`, uploadError.message, '. Falling back to local disk.');
      }
    } catch (err) {
      console.warn('Supabase Storage upload exception:', err.message, '. Falling back to local disk.');
    }
  }

  // Local disk fallback — identical URL shape the app already used before
  // (served statically at /uploads/<folder>/<filename> by server.js).
  const dir = ensureLocalDir(folder);
  fs.writeFileSync(path.join(dir, filename), buffer);
  return { url: `/uploads/${folder}/${filename}`, storage: 'LOCAL_DISK', path: storagePath };
}

function isMediaStorageOnSupabase() {
  return isSupabaseConfigured();
}

module.exports = { uploadMedia, isMediaStorageOnSupabase, MEDIA_BUCKET };
