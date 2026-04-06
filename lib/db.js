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

const isVercel = !!process.env.VERCEL || !!process.env.UPSTASH_REDIS_REST_URL || !!process.env.KV_REST_API_URL;
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
  const { Redis } = require('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  });
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
