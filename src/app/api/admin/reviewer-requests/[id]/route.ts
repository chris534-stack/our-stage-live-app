import { NextResponse } from 'next/server';
import { updateReviewerRequestStatus, updateReviewerRequestArchived } from '@/lib/data';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, archived } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Handle status updates
    if (status !== undefined) {
      if (!['approved', 'denied'].includes(status)) {
        return NextResponse.json(
          { error: 'Valid status (approved or denied) is required' },
          { status: 400 }
        );
      }
      const success = await updateReviewerRequestStatus(id, status);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update reviewer request status' },
          { status: 500 }
        );
      }
    }

    // Handle archiving
    if (archived !== undefined) {
      const success = await updateReviewerRequestArchived(id, archived);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update reviewer request archived status' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reviewer request:', error);
    return NextResponse.json(
      { error: 'Failed to update reviewer request' },
      { status: 500 }
    );
  }
}
