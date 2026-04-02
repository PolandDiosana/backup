/**
 * POST /api/backup/upload
 *
 * Dual-mode file storage:
 * - Production (Vercel): streams the ZIP directly to Vercel Blob.
 * - Local development:   saves the ZIP to .backups/<id>.zip on disk.
 *
 * Vercel Blob is detected via the BLOB_READ_WRITE_TOKEN env variable
 * which Vercel sets automatically when you link a Blob store.
 *
 * NOTE: Vercel's default body size limit for API routes is 4.5 MB.
 * To support larger uploads the client already compresses the folder to a
 * ZIP in the browser and sends it as multipart/form-data.  If you need to
 * lift the limit further, add the following to this file:
 *
 *   export const config = { api: { bodyParser: false } };
 *
 * and use the streaming Blob API (put with a ReadableStream).
 */

import { NextResponse } from 'next/server';
import { addBackup } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;

// Raise Next.js body-size limit to 500 MB (local dev only; Vercel ignores this)
export const config = {
  api: { bodyParser: { sizeLimit: '500mb' } },
};

export async function POST(request) {
  try {
    const formData   = await request.formData();
    const file       = formData.get('file');
    const folderName = formData.get('folderName') || 'Backup';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const id     = crypto.randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const size   = buffer.length;

    let blobUrl = null;

    if (isVercel) {
      // ── Vercel Blob ──────────────────────────────────────────────────────
      const { put } = await import('@vercel/blob');
      const blob = await put(`backups/${id}.zip`, buffer, {
        access: 'public',      // 'private' requires signed URLs; 'public' works for personal use
        contentType: 'application/zip',
      });
      blobUrl = blob.url;
    } else {
      // ── Local filesystem ─────────────────────────────────────────────────
      const LOCAL_DIR = path.join(process.cwd(), '.backups');
      await fs.mkdir(LOCAL_DIR, { recursive: true });
      await fs.writeFile(path.join(LOCAL_DIR, `${id}.zip`), buffer);
    }

    const metadata = {
      id,
      name: folderName,
      createdAt: new Date().toISOString(),
      size,
      blobUrl,  // null when running locally
    };

    await addBackup(metadata);
    return NextResponse.json({ success: true, backup: metadata });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
