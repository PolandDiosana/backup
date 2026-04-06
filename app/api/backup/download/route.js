/**
 * GET /api/backup/download?id=<backup-id>
 *
 * Dual-mode download:
 * - Production (Vercel): the backup metadata already contains a public Blob URL,
 *   so we redirect the browser straight to Vercel Blob CDN — no proxying needed.
 * - Local development:   we stream the ZIP file from the local .backups/ folder.
 */

import { NextResponse } from 'next/server';
import { getBackups } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const isVercel = !!process.env.VERCEL || !!process.env.BLOB_READ_WRITE_TOKEN;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  try {
    if (isVercel) {
      // ── Vercel: redirect to the public Blob CDN URL ──────────────────────
      const backups = await getBackups();
      const backup  = backups.find(b => b.id === id);

      if (!backup) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      }
      if (!backup.blobUrl) {
        return NextResponse.json({ error: 'Blob URL missing for this backup' }, { status: 500 });
      }

      // Fetch the private blob server-side (server holds the token) then
      // stream it to the browser so users don't need direct Blob access.
      const blobRes = await fetch(backup.blobUrl, {
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
      });
      if (!blobRes.ok) {
        return NextResponse.json({ error: 'Could not fetch file from Blob storage' }, { status: 502 });
      }

      return new NextResponse(blobRes.body, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(backup.name)}.zip"`,
        },
      });

    } else {
      // ── Local: stream from disk ──────────────────────────────────────────
      const filePath = path.join(process.cwd(), '.backups', `${id}.zip`);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }

      const stat       = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);

      return new NextResponse(fileStream, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="backup_${id}.zip"`,
          'Content-Length': stat.size.toString(),
        },
      });
    }

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
