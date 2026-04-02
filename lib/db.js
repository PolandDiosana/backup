/**
 * lib/db.js
 *
 * Dual-mode database:
 * - Production (Vercel): uses @vercel/kv (Redis-based key-value store)
 * - Local development:   uses a local JSON file at .backups/db.json
 *
 * The mode is detected automatically via the KV_REST_API_URL env variable
 * which Vercel sets automatically when you link a KV store.
 */

import fs from 'fs/promises';
import path from 'path';

const isVercel = !!process.env.KV_REST_API_URL;
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

// ─── Vercel KV helpers ─────────────────────────────────────────────────────
async function kvRead() {
  const { kv } = await import('@vercel/kv');
  const backups = await kv.get(BACKUP_KEY);
  return Array.isArray(backups) ? backups : [];
}

async function kvWrite(backups) {
  const { kv } = await import('@vercel/kv');
  await kv.set(BACKUP_KEY, backups);
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

  // Only try to clean up local file in local mode
  if (!isVercel) {
    try {
      await fs.rm(path.join(LOCAL_DIR, `${id}.zip`), { force: true });
    } catch { /* ignore */ }
  }
}
