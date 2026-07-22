/**
 * Copy remote images to GCS for blog sync (stable object paths under blog/).
 */
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET_DEFAULT = 'courts-image-bucket';
const GCS_BUCKET_NAME = (process.env.GCS_BUCKET_NAME || GCS_BUCKET_DEFAULT).trim();
const BLOG_IMAGE_TARGET_BYTES = 200 * 1024;
const BLOG_COVER_MAX_WIDTH = 1600;
const BLOG_INLINE_MAX_WIDTH = 1200;

let gcsStorage = null;
let gcsBucket = null;
let sharpModulePromise = null;

function ensureGcsCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const apiDir = path.join(process.cwd(), 'api');
  try {
    if (!fs.existsSync(apiDir)) return;
    for (const name of fs.readdirSync(apiDir)) {
      if (!name.endsWith('.json')) continue;
      const fullPath = path.join(apiDir, name);
      try {
        const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (raw?.type === 'service_account' && raw?.private_key) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPath;
          return;
        }
      } catch (_) {
        // not a service account key
      }
    }
  } catch (_) {
    // ignore
  }
}

function getGcsBucket() {
  if (!GCS_BUCKET_NAME) return null;
  if (!gcsBucket) {
    ensureGcsCredentials();
    gcsStorage = new Storage();
    gcsBucket = gcsStorage.bucket(GCS_BUCKET_NAME);
  }
  return gcsBucket;
}

function extFromMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/avif') return 'avif';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'bin';
}

function gcsPublicUrl(objectPath) {
  return `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${encodeURIComponent(objectPath).replace(/%2F/g, '/')}`;
}

function isGcsBlogUrl(remoteUrl) {
  return /^https:\/\/storage\.googleapis\.com\//i.test(String(remoteUrl || '').trim())
    && /\/blog\//i.test(String(remoteUrl || '').trim());
}

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp')
      .then((mod) => mod.default || mod)
      .catch(() => null);
  }
  return sharpModulePromise;
}

async function readRemoteImage(remoteUrl) {
  const response = await axios.get(remoteUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  const contentTypeRaw = String(response.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
  const mimeType = contentTypeRaw.startsWith('image/') ? contentTypeRaw : 'image/jpeg';
  return { mimeType, buffer: Buffer.from(response.data) };
}

async function optimizeImageForBlog(buffer, mimeType, { isCover = false } = {}) {
  if (!buffer?.length) return { buffer, mimeType, ext: extFromMimeType(mimeType) };
  if (mimeType === 'image/svg+xml' || mimeType === 'image/gif') {
    return { buffer, mimeType, ext: extFromMimeType(mimeType) };
  }

  const sharp = await getSharp();
  if (!sharp) {
    return { buffer, mimeType, ext: extFromMimeType(mimeType) };
  }

  const maxWidth = isCover ? BLOG_COVER_MAX_WIDTH : BLOG_INLINE_MAX_WIDTH;
  const qualitySteps = [82, 74, 66, 58, 50, 42];

  for (const quality of qualitySteps) {
    const output = await sharp(buffer)
      .rotate()
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
    if (output.length <= BLOG_IMAGE_TARGET_BYTES || quality === qualitySteps[qualitySteps.length - 1]) {
      return { buffer: output, mimeType: 'image/webp', ext: 'webp' };
    }
  }

  return { buffer, mimeType, ext: extFromMimeType(mimeType) };
}

/**
 * Download a remote image and upload to GCS with a stable object name.
 * @param {string} remoteUrl
 * @param {string} pageId Notion page id (folder segment)
 * @param {string} objectKey stable key e.g. block id or "cover"
 */
export async function copyRemoteImageToBlogGcs(remoteUrl, pageId, objectKey) {
  if (!remoteUrl || typeof remoteUrl !== 'string') return null;
  if (/^https:\/\/storage\.googleapis\.com\//i.test(remoteUrl.trim()) && !isGcsBlogUrl(remoteUrl)) {
    return remoteUrl.trim();
  }

  const bucket = getGcsBucket();
  if (!bucket) {
    throw new Error('GCS_BUCKET_NAME is not configured');
  }

  const safePage = String(pageId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeKey = String(objectKey || crypto.randomBytes(6).toString('hex')).replace(/[^a-zA-Z0-9_-]/g, '');
  const { mimeType, buffer } = await readRemoteImage(remoteUrl);
  const optimized = await optimizeImageForBlog(buffer, mimeType, { isCover: safeKey === 'cover' });
  const ext = optimized.ext || extFromMimeType(optimized.mimeType);
  const objectPath = `blog/${safePage}/${safeKey}.${ext}`;
  const file = bucket.file(objectPath);
  await file.save(optimized.buffer, {
    contentType: optimized.mimeType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=86400',
    },
  });
  return gcsPublicUrl(objectPath);
}
