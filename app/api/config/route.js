/**
 * GET /api/config
 * Tells the frontend which upload mode to use.
 * - useClientUpload: true  → Vercel deployment, upload directly to Blob from browser
 * - useClientUpload: false → local dev, upload through the API route
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    useClientUpload: !!process.env.VERCEL || !!process.env.BLOB_READ_WRITE_TOKEN,
  });
}
