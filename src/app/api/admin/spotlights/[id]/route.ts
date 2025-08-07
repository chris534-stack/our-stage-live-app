import { NextResponse } from 'next/server';
import { deleteSpotlight } from '@/lib/data';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Spotlight ID is required' },
        { status: 400 }
      );
    }

    const success = await deleteSpotlight(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete spotlight' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting spotlight:', error);
    return NextResponse.json(
      { error: 'Failed to delete spotlight' },
      { status: 500 }
    );
  }
}
