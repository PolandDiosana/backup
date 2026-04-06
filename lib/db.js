/**
 * lib/db.js
 *
 * Dual-mode database:
 * - Production (Vercel + Upstash): uses @upstash/redis
 * - Local development:             uses a local JSON file at .backups/db.json
 *
 * The mode is detected automatically via the UPSTASH_REDIS_REST_URL env var,
 * which Vercel sets automatically when you connect an Upstash store.
 */

import fs from 'fs/promises';
import path from 'path';

const isVercel = !!process.env.VERCEL || !!process.env.UPSTASH_REDIS_REST_URL || !!process.env.KV_REST_API_URL || !!process.env.REDIS_URL;
const BACKUP_KEY = 'cloudbackup:backups';

// ─── Local mode helpers ────────────────────────────────────────────────────
const LOCAL_DIR = path.join(process.cwd(), '.backups');
const LOCAL_DB  = path.join(LOCAL_DIR, 'db.json');

async function localInit() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  try { await fs.access(LOCAL_DB); }
  catch { await fs.writeFile(LOCAL_DB, JSON.stringify({ backups: [] }, null, 2)); }
}

async function localRead() {
  await localInit();
  try {
    const raw = await fs.readFile(LOCAL_DB, 'utf-8');
    return JSON.parse(raw).backups;
  } catch { return []; }
}

async function localWrite(backups) {
  await localInit();
  await fs.writeFile(LOCAL_DB, JSON.stringify({ backups }, null, 2));
}

// ─── Upstash Redis helpers ─────────────────────────────────────────────────
function getRedis() {
  // Use a more robust strategy: scan all environment variables for an HTTPS URL
  let url = null;
  let token = null;

  // 1. Look for variables ending in _URL or containing _REST_API_URL that start with https://
  for (const [key, val] of Object.entries(process.env)) {
    if (val && typeof val === 'string' && val.startsWith('https://')) {
      // Prioritize the standard names or anything that looks like an Upstash/KV URL
      if (key.includes('REST_API_URL') || key.includes('REDIS_REST_URL') || key.includes('KV_URL')) {
        url = val;
        
        // Try to find a matching token (e.g. if key is KV_REST_API_URL, look for KV_REST_API_TOKEN)
        const baseKey = key.replace(/_URL$/, '');
        const tokenKey = `${baseKey}_TOKEN`;
        if (process.env[tokenKey]) {
          token = process.env[tokenKey];
        }
        break;
      }
    }
  }

  // 2. Fallback to extracting from URL if token still missing
  if (url && !token) {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        token = parsed.password;
        parsed.username = '';
        parsed.password = '';
        url = parsed.toString().replace(/\/$/, '');
      }
    } catch { /* ignore */ }
  }

  // 3. Fallback: if STILL missing, check the usual suspects individually
  if (!url || !token) {
    url = url || process.env.REDIS_URL__KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    token = token || process.env.REDIS_URL__KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  }

  // 4. Diagnostic error for TCP-only URLs
  if (!url && process.env.REDIS_URL && process.env.REDIS_URL.startsWith('redis://')) {
    throw new Error(
      `Your REDIS_URL is a TCP connection (redis://), but this project uses '@upstash/redis' which requires an HTTPS REST endpoint. \n\n` +
      `Fix: In Vercel, please create a 'KV' or 'Upstash Redis' store, which provides the correct HTTPS URL.`
    );
  }

  if (!url || !token) {
    throw new Error(
      "Missing HTTPS Redis configuration. Please link a 'Vercel KV' or 'Upstash Redis' store in your Vercel Dashboard."
    );
  }

  const { Redis } = require('@upstash/redis');
  return new Redis({ url, token });
}


async function kvRead() {
  const redis = getRedis();
  const backups = await redis.get(BACKUP_KEY);
  return Array.isArray(backups) ? backups : [];
}

async function kvWrite(backups) {
  const redis = getRedis();
  await redis.set(BACKUP_KEY, backups);
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function getBackups() {
  return isVercel ? await kvRead() : await localRead();
}

export async function addBackup(backup) {
  const backups = await getBackups();
  backups.unshift(backup);
  isVercel ? await kvWrite(backups) : await localWrite(backups);
  return backup;
}

export async function deleteBackup(id) {
  const backups = await getBackups();
  const filtered = backups.filter(b => b.id !== id);
  isVercel ? await kvWrite(filtered) : await localWrite(filtered);

  // Clean up the local ZIP file in dev mode
  if (!isVercel) {
    try {
      await fs.rm(path.join(LOCAL_DIR, `${id}.zip`), { force: true });
    } catch { /* ignore */ }
  }
}
