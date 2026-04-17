const crypto = require('crypto');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter
});

let supabaseClient = null;

const getSupabaseClient = () => {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or SUPABASE_PUBLISHABLE_KEY must be configured'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseClient;
};

const getStorageBucket = () => process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

const getFileExtensionFromMimeType = (mimeType) => {
  const extMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/svg+xml': 'svg'
  };

  return extMap[mimeType] || 'jpg';
};

const createUniqueFileName = (farmerId, mimeType) => {
  const extension = getFileExtensionFromMimeType(mimeType);
  const uniqueId = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `products/${farmerId}/${uniqueId}.${extension}`;
};

const uploadToSupabaseStorage = async (fileBuffer, mimeType, farmerId) => {
  const supabase = getSupabaseClient();
  const bucket = getStorageBucket();
  const filePath = createUniqueFileName(farmerId, mimeType);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600'
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl
  };
};

const extractStoragePathFromUrl = (imageUrl, bucket) => {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith('http')) return imageUrl;

  try {
    const parsedUrl = new URL(imageUrl);
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;

    if (parsedUrl.pathname.includes(publicMarker)) {
      return decodeURIComponent(parsedUrl.pathname.split(publicMarker)[1]);
    }

    if (parsedUrl.pathname.includes(signedMarker)) {
      return decodeURIComponent(parsedUrl.pathname.split(signedMarker)[1]);
    }
  } catch (error) {
    return null;
  }

  return null;
};

const deleteFromSupabaseStorage = async (imageUrlOrPath) => {
  try {
    const supabase = getSupabaseClient();
    const bucket = getStorageBucket();
    const filePath = extractStoragePathFromUrl(imageUrlOrPath, bucket);

    if (!filePath) return;

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error('Error deleting image from Supabase Storage:', error.message);
    }
  } catch (error) {
    console.error('Error deleting image from Supabase Storage:', error.message);
  }
};

module.exports = {
  upload,
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage
};
