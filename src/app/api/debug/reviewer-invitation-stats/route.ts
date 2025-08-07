import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ReviewerInvitation } from '@/lib/types';

/**
 * GET /api/debug/reviewer-invitation-stats
 * 
 * Returns comprehensive statistics about reviewer invitations for debugging purposes.
 * This endpoint should only be available in development or to admin users.
 */
export async function GET(request: NextRequest) {
  try {
    // In production, you should add authentication/authorization here
    if (process.env.NODE_ENV === 'production') {
      // Check if user is admin
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Add your admin verification logic here
    }

    // Fetch all reviewer invitations
    const invitationsSnapshot = await adminDb
      .collection('reviewerInvitations')
      .orderBy('createdAt', 'desc')
      .get();

    const invitations = invitationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ReviewerInvitation[];

    // Calculate statistics
    const totalInvitations = invitations.length;
    const pendingInvitations = invitations.filter(inv => inv.status === 'pending').length;
    const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted').length;
    const expiredInvitations = invitations.filter(inv => inv.status === 'expired').length;

    // Calculate average acceptance time (in hours)
    const acceptedWithTimes = invitations.filter(inv => 
      inv.status === 'accepted' && inv.usedAt && inv.createdAt
    );
    
    let averageAcceptanceTime = 0;
    if (acceptedWithTimes.length > 0) {
      const totalAcceptanceTime = acceptedWithTimes.reduce((sum, inv) => {
        const created = new Date(inv.createdAt).getTime();
        const accepted = new Date(inv.usedAt!).getTime();
        return sum + (accepted - created);
      }, 0);
      
      averageAcceptanceTime = Math.round(
        (totalAcceptanceTime / acceptedWithTimes.length) / (1000 * 60 * 60)
      ); // Convert to hours
    }

    // Calculate error rate (expired invitations as a percentage)
    const errorRate = totalInvitations > 0 
      ? (expiredInvitations / totalInvitations) * 100 
      : 0;

    // Recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentInvitations = invitations.filter(inv => 
      new Date(inv.createdAt) > last24Hours
    );

    // Token distribution analysis
    const tokenLengths = invitations.map(inv => inv.token?.length || 0);
    const averageTokenLength = tokenLengths.length > 0 
      ? Math.round(tokenLengths.reduce((a, b) => a + b, 0) / tokenLengths.length)
      : 0;

    // Expiry analysis
    const now = new Date();
    const soonToExpire = invitations.filter(inv => {
      if (inv.status !== 'pending') return false;
      const expiryDate = new Date(inv.expiresAt);
      const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilExpiry <= 24; // Expiring within 24 hours
    }).length;

    const stats = {
      totalInvitations,
      pendingInvitations,
      acceptedInvitations,
      expiredInvitations,
      averageAcceptanceTime,
      errorRate: Math.round(errorRate * 10) / 10, // Round to 1 decimal place
      recentActivity: {
        last24Hours: recentInvitations.length,
        recentAcceptances: recentInvitations.filter(inv => inv.status === 'accepted').length,
      },
      tokenAnalysis: {
        averageTokenLength,
        uniqueTokens: new Set(invitations.map(inv => inv.token)).size,
      },
      expiryAnalysis: {
        soonToExpire,
        averageDaysToExpiry: 7, // Standard expiry period
      },
      invitationsByStatus: {
        pending: pendingInvitations,
        accepted: acceptedInvitations,
        expired: expiredInvitations,
      },
      topInviters: await getTopInviters(invitations),
      healthScore: calculateHealthScore({
        totalInvitations,
        acceptedInvitations,
        expiredInvitations,
        errorRate,
      }),
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching reviewer invitation stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitation statistics' },
      { status: 500 }
    );
  }
}

async function getTopInviters(invitations: ReviewerInvitation[]) {
  const inviterCounts = invitations.reduce((acc, inv) => {
    const key = `${inv.invitedBy}:${inv.invitedByName}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(inviterCounts)
    .map(([key, count]) => {
      const [userId, name] = key.split(':');
      return { userId, name, invitationCount: count };
    })
    .sort((a, b) => b.invitationCount - a.invitationCount)
    .slice(0, 5); // Top 5 inviters
}

function calculateHealthScore(metrics: {
  totalInvitations: number;
  acceptedInvitations: number;
  expiredInvitations: number;
  errorRate: number;
}) {
  const { totalInvitations, acceptedInvitations, expiredInvitations, errorRate } = metrics;
  
  if (totalInvitations === 0) return 100; // Perfect score if no invitations yet
  
  const acceptanceRate = (acceptedInvitations / totalInvitations) * 100;
  const expiryRate = (expiredInvitations / totalInvitations) * 100;
  
  // Health score calculation:
  // - High acceptance rate is good (max 40 points)
  // - Low expiry rate is good (max 30 points)
  // - Low error rate is good (max 30 points)
  
  const acceptanceScore = Math.min(40, acceptanceRate * 0.8);
  const expiryScore = Math.max(0, 30 - (expiryRate * 1.5));
  const errorScore = Math.max(0, 30 - (errorRate * 2));
  
  return Math.round(acceptanceScore + expiryScore + errorScore);
}
