/**
 * POST /api/backup/metadata
 * Saves backup metadata to the database after a successful client-side
 * Vercel Blob upload. Only needs the blob URL + folder name — no file data.
 */
import { NextResponse } from 'next/server';
import { addBackup } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { name, size, blobUrl } = await request.json();

    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl' }, { status: 400 });
    }

    const metadata = {
      id: crypto.randomUUID(),
      name: name || 'Backup',
      createdAt: new Date().toISOString(),
      size: size || 0,
      blobUrl,
    };

    await addBackup(metadata);
    return NextResponse.json({ success: true, backup: metadata });
  } catch (error) {
    console.error('Metadata save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
