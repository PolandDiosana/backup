/**
 * POST /api/blob
 * Vercel Blob client-upload token handler.
 *
 * When the browser uses @vercel/blob/client's upload(), it first calls this
 * endpoint to get a short-lived signed upload token. The file then goes
 * DIRECTLY from the browser to Vercel Blob CDN — it never passes through
 * the serverless function body, so the 4.5 MB limit is completely bypassed.
 *
 * Only used in production (BLOB_READ_WRITE_TOKEN is set).
 */
import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/zip'],
        maximumSizeInBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      }),
      onUploadCompleted: async ({ blob }) => {
        // Metadata is saved separately by /api/backup/metadata
        // after the client-side upload() call resolves.
        console.log('Direct blob upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Blob token error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
