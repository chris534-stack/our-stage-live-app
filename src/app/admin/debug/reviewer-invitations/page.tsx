import { Metadata } from 'next';
import { ReviewerInvitationDebugDashboard } from '@/components/debug/ReviewerInvitationDebugDashboard';

export const metadata: Metadata = {
  title: 'Reviewer Invitation Debug | Admin',
  description: 'Debug and monitor the reviewer invitation pipeline',
};

export default function ReviewerInvitationDebugPage() {
  return (
    <div className="container mx-auto py-6">
      <ReviewerInvitationDebugDashboard />
    </div>
  );
}
