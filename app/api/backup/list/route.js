import { NextResponse } from 'next/server';
import { getBackups, deleteBackup } from '@/lib/db';

export async function GET() {
  try {
    const backups = await getBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch backups' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    
    await deleteBackup(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}
