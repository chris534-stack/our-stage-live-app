'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  UserCheck, Clock, CheckCircle, XCircle, Eye, Mail, Send, Copy, ExternalLink, 
  Loader2, Trash2, UserX, Search, Filter, Users, Activity, AlertCircle,
  TrendingUp, Calendar, Star
} from 'lucide-react';
import type { ReviewerRequest, ReviewerInvitation, UserProfile } from '@/lib/types';

// Sub-components
import { StatsGrid } from './reviewer-hub/StatsGrid';
import { ActionableItems } from './reviewer-hub/ActionableItems';
import { ReviewerList } from './reviewer-hub/ReviewerList';
import { ActivityFeed } from './reviewer-hub/ActivityFeed';
import { ReviewerApplications } from './ReviewerApplications';

export function ReviewerHub() {
  // State management
  const [reviewerRequests, setReviewerRequests] = useState<ReviewerRequest[]>([]);
  const [reviewerInvitations, setReviewerInvitations] = useState<ReviewerInvitation[]>([]);
  const [reviewers, setReviewers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('applications');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  // Data filtering and processing
  const activeRequests = reviewerRequests.filter(app => !app.archived);
  const activeInvitations = reviewerInvitations.filter(inv => !inv.archived);
  
  const pendingApplications = activeRequests.filter(app => app.status === 'pending');
  const approvedApplications = activeRequests.filter(app => app.status === 'approved');
  const deniedApplications = activeRequests.filter(app => app.status === 'denied');
  const pendingInvitations = activeInvitations.filter(inv => inv.status === 'pending');
  
  // Actionable items (high priority)
  const actionableItems = [
    ...pendingApplications.map(app => ({ ...app, type: 'application' as const })),
    ...pendingInvitations.map(inv => ({ ...inv, type: 'invitation' as const }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Stats for dashboard
  const stats = {
    pendingApplications: pendingApplications.length,
    pendingInvitations: pendingInvitations.length,
    approvedApplications: approvedApplications.length,
    deniedApplications: deniedApplications.length,
    activeReviewers: reviewers.filter(r => r.isReviewer).length,
    totalReviews: 0 // TODO: Calculate from reviews data
  };

  // Data fetching
  useEffect(() => {
    Promise.all([
      fetchReviewerRequests(),
      fetchReviewerInvitations(),
      fetchReviewers()
    ]).finally(() => setLoading(false));
  }, []);

  const fetchReviewerRequests = async () => {
    try {
      const response = await fetch('/api/admin/reviewer-requests');
      if (!response.ok) throw new Error('Failed to fetch reviewer requests');
      const data = await response.json();
      setReviewerRequests(data.reviewerRequests || []);
    } catch (err) {
      console.error('Error fetching reviewer requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviewer requests');
    }
  };

  const fetchReviewerInvitations = async () => {
    try {
      const response = await fetch('/api/admin/reviewer-invitations');
      if (!response.ok) throw new Error('Failed to fetch reviewer invitations');
      const data = await response.json();
      setReviewerInvitations(data.invitations || []);
    } catch (err) {
      console.error('Error fetching reviewer invitations:', err);
    }
  };

  const fetchReviewers = async () => {
    try {
      const response = await fetch('/api/admin/reviewers');
      if (!response.ok) throw new Error('Failed to fetch reviewers');
      const data = await response.json();
      setReviewers(data.reviewers || []);
    } catch (err) {
      console.error('Error fetching reviewers:', err);
    }
  };

  const handleCreateInvitation = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setInviting(true);
      const response = await fetch('/api/admin/reviewer-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create invitation');
      }
      
      const data = await response.json();
      
      // Copy invite link to clipboard
      if (navigator.clipboard && data.inviteLink) {
        await navigator.clipboard.writeText(data.inviteLink);
        toast({
          title: 'Invitation Created!',
          description: 'Invitation link has been copied to your clipboard.',
        });
      } else {
        toast({
          title: 'Invitation Created!',
          description: 'Invitation created successfully.',
        });
      }
      
      // Reset form and refresh data
      setInviteEmail('');
      setShowInviteDialog(false);
      await fetchReviewerInvitations();
      
    } catch (err) {
      console.error('Error creating invitation:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create invitation.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading reviewer data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">Error: {error}</div>
          <div className="text-center mt-2">
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline mb-1">🎭 Reviewer Hub</h2>
          <p className="text-muted-foreground">Manage reviewers, applications & invitations</p>
        </div>
        <Button 
          onClick={() => setShowInviteDialog(true)} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
        >
          <Mail className="mr-2 h-4 w-4" />
          Invite Reviewer
        </Button>
      </div>

      {/* Stats Dashboard */}
      <StatsGrid stats={stats} />

      {/* Actionable Items - Always Visible */}
      {actionableItems.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-900">🔥 Needs Action ({actionableItems.length})</h3>
          </div>
          <ActionableItems 
            items={actionableItems} 
            onRefresh={() => {
              fetchReviewerRequests();
              fetchReviewerInvitations();
            }}
          />
        </div>
      )}

      {/* Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reviewers, applications, or invitations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Main Content - Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Applications</span>
            <span className="sm:hidden">Apps</span>
            {actionableItems.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {actionableItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Reviewers</span>
            <span className="sm:hidden">Team</span>
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
              {stats.activeReviewers}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
            <span className="sm:hidden">Feed</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <ReviewerApplications />
        </TabsContent>

        <TabsContent value="reviewers" className="mt-4">
          <ReviewerList 
            reviewers={reviewers.filter(r => r.isReviewer)} 
            searchQuery={searchQuery}
            onRefresh={fetchReviewers}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityFeed />
        </TabsContent>
      </Tabs>

      {/* Invite Reviewer Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New Reviewer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="reviewer@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !inviting) {
                    handleCreateInvitation();
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">What happens next:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• A secure invitation link will be created</li>
                <li>• The link will be copied to your clipboard</li>
                <li>• Share the link with the reviewer via email or message</li>
                <li>• They'll sign in with Google and get reviewer access instantly</li>
                <li>• The link expires in 7 days</li>
              </ul>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateInvitation} 
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1"
              >
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Create Invitation
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteEmail('');
                }}
                disabled={inviting}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
