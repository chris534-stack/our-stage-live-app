import { NextResponse } from 'next/server';
import { updateSpotlight } from '@/lib/data';

export async function POST(
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

    const success = await updateSpotlight(id, { isActive: true });
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to activate spotlight' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error activating spotlight:', error);
    return NextResponse.json(
      { error: 'Failed to activate spotlight' },
      { status: 500 }
    );
  }
}
