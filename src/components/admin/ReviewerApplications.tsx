'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Clock, CheckCircle, XCircle, Eye, Mail, Send, Copy, ExternalLink, Loader2, Trash2, UserX } from 'lucide-react';
import type { ReviewerRequest, ReviewerInvitation, UserProfile } from '@/lib/types';



function getStatusBadge(status: ReviewerRequest['status']) {
  switch(status) {
    case 'approved': 
      return (
        <Badge variant="secondary" className="border-green-600/40 bg-green-500/10 text-green-700">
          <CheckCircle className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case 'pending': 
      return (
        <Badge variant="secondary" className="border-yellow-600/40 bg-yellow-500/10 text-yellow-700">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    case 'denied': 
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Denied
        </Badge>
      );
    default:
      return null;
  }
}

export function ReviewerApplications() {
  const [reviewerRequests, setReviewerRequests] = useState<ReviewerRequest[]>([]);
  const [reviewerInvitations, setReviewerInvitations] = useState<ReviewerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingRequest, setViewingRequest] = useState<ReviewerRequest | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  // Filter out archived items from main displays
  const activeRequests = reviewerRequests.filter(app => !app.archived);
  const activeInvitations = reviewerInvitations.filter(inv => !inv.archived);
  
  const pendingApplications = activeRequests.filter(app => app.status === 'pending');
  const approvedApplications = activeRequests.filter(app => app.status === 'approved');
  const deniedApplications = activeRequests.filter(app => app.status === 'denied');
  
  // For "Recent Applications" display, only show pending and denied (exclude approved)
  const recentApplications = activeRequests.filter(app => app.status !== 'approved');
  
  // For invitations, we want to show pending ones in the main section
  // and hide accepted/archived ones completely (since they become reviewers)
  const pendingInvitations = activeInvitations.filter(inv => inv.status === 'pending');
  
  // REMOVE accepted invitations from display - they should be archived automatically
  // const acceptedInvitations = activeInvitations.filter(inv => inv.status === 'accepted');

  useEffect(() => {
    fetchReviewerRequests();
    fetchReviewerInvitations();
  }, []);

  const fetchReviewerRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/reviewer-requests');
      if (!response.ok) {
        throw new Error('Failed to fetch reviewer requests');
      }
      const data = await response.json();
      setReviewerRequests(data.reviewerRequests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviewer requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'approved' | 'denied') => {
    try {
      const response = await fetch(`/api/admin/reviewer-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${status} reviewer request`);
      }
      
      // If approved, automatically archive the application
      if (status === 'approved') {
        await archiveApplication(id);
      }
      
      await fetchReviewerRequests(); // Refresh data
      toast({
        title: 'Success!',
        description: `Reviewer request ${status} successfully${status === 'approved' ? ' and archived' : ''}.`,
      });
    } catch (err) {
      console.error(`Error ${status}ing reviewer request:`, err);
      toast({
        title: 'Error',
        description: `Failed to ${status} reviewer request.`,
        variant: 'destructive',
      });
    }
  };

  const archiveApplication = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/reviewer-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to archive application');
      }
    } catch (err) {
      console.error('Error archiving application:', err);
      // Don't show error toast for archiving since it's automatic
    }
  };

  const archiveInvitation = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/reviewer-invitations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to archive invitation');
      }
    } catch (err) {
      console.error('Error archiving invitation:', err);
      // Don't show error toast for archiving since it's automatic
    }
  };

  const fetchReviewerInvitations = async () => {
    try {
      console.log('🔄 Fetching reviewer invitations...');
      const response = await fetch('/api/admin/reviewer-invitations');
      console.log('🔄 Fetch response status:', response.status, response.ok);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviewer invitations');
      }
      
      const data = await response.json();
      console.log('🔄 Fetch response data:', data);
      console.log('🔄 Number of invitations received:', data.invitations?.length || 0);
      
      setReviewerInvitations(data.invitations || []);
      console.log('🔄 State updated with new invitations');
    } catch (err) {
      console.error('🔄 Error fetching reviewer invitations:', err);
      // Don't show error toast for invitations, as it's secondary to main functionality
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
        headers: {
          'Content-Type': 'application/json',
        },
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
          description: 'Invite link copied to clipboard. Share it with the reviewer.',
        });
      } else {
        toast({
          title: 'Invitation Created!',
          description: 'Reviewer invitation created successfully.',
        });
      }
      
      // Reset form and close dialog
      setInviteEmail('');
      setShowInviteDialog(false);
      
      // Refresh invitations list
      await fetchReviewerInvitations();
    } catch (err) {
      console.error('Error creating reviewer invitation:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create invitation.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    const inviteLink = `${window.location.origin}/invite/reviewer/${token}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: 'Link Copied!',
        description: 'Invite link copied to clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const deleteInvitation = async (invitationId: string, email: string) => {
    console.log('🔥 Delete button clicked for:', { invitationId, email });
    
    // TEMPORARILY SKIP CONFIRMATION FOR DEBUGGING
    console.log('🔥 Skipping confirmation dialog for debugging - proceeding with deletion...');


    try {
      const deleteUrl = `/api/admin/reviewer-invitations?id=${invitationId}`;
      console.log('🔥 DELETE URL:', deleteUrl);
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });
      
      console.log('🔥 Delete response status:', response.status, response.statusText);
      console.log('🔥 Delete response ok:', response.ok);
      
      const responseData = await response.json();
      console.log('🔥 Delete response data:', responseData);

      if (!response.ok) {
        console.error('🔥 DELETE FAILED - Response not ok:', responseData);
        throw new Error(responseData.error || 'Failed to delete invitation');
      }

      console.log('🔥 Delete successful! Now refreshing invitations list...');
      console.log('🔥 Current invitations before refresh:', reviewerInvitations.length);
      
      // Refresh invitations list
      await fetchReviewerInvitations();
      
      console.log('🔥 fetchReviewerInvitations completed');
      console.log('🔥 Current invitations after refresh:', reviewerInvitations.length);
      
      toast({
        title: 'Invitation Deleted',
        description: `Invitation for ${email} has been deleted successfully.`,
      });
      
      console.log('🔥 Delete operation completed successfully!');
    } catch (err) {
      console.error('🔥 ERROR deleting invitation:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete invitation.',
        variant: 'destructive',
      });
    }
  };

  const revokeReviewerByEmail = async (email: string) => {
    if (!confirm(`Are you sure you want to revoke reviewer privileges from ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      // First, get the user's profile to find their userId
      const usersResponse = await fetch('/api/admin/users');
      if (!usersResponse.ok) {
        throw new Error('Failed to fetch user data');
      }
      const users = await usersResponse.json();
      const user = users.find((u: UserProfile) => u.email === email);
      
      if (!user) {
        throw new Error(`Could not find user with email ${email}`);
      }

      // Now revoke their reviewer status
      const response = await fetch('/api/admin/users/reviewer-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          isReviewer: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke reviewer status');
      }
      
      toast({
        title: 'Reviewer Status Revoked',
        description: `Reviewer privileges have been removed from ${user.displayName || email}.`,
      });
    } catch (error) {
      console.error('Error revoking reviewer status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke reviewer status.',
        variant: 'destructive',
      });
    }
  };

  // Invitation filtering moved to top of component - removing duplicate

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold font-headline mb-2">Reviewer Management</h2>
          <p className="text-muted-foreground">Review applications and invite new reviewers</p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Mail className="mr-2 h-4 w-4" />
          Invite Reviewer
        </Button>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col items-center text-center space-y-1 md:flex-row md:items-center md:space-y-0 md:space-x-3 md:text-left">
              <Clock className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{pendingApplications.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">Pending Applications</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col items-center text-center space-y-1 md:flex-row md:items-center md:space-y-0 md:space-x-3 md:text-left">
              <Mail className="h-6 w-6 md:h-8 md:w-8 text-amber-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{pendingInvitations.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">Pending Invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col items-center text-center space-y-1 md:flex-row md:items-center md:space-y-0 md:space-x-3 md:text-left">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{approvedApplications.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col items-center text-center space-y-1 md:flex-row md:items-center md:space-y-0 md:space-x-3 md:text-left">
              <XCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{deniedApplications.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">Denied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Recent Applications</h3>
        
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">Loading reviewer requests...</div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-red-600">Error: {error}</div>
              <div className="text-center mt-2">
                <Button onClick={fetchReviewerRequests} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : recentApplications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No pending reviewer applications</p>
              <p className="text-sm text-muted-foreground">
                Pending applications will appear here. Approved applications are moved to Reviewer Management.
              </p>
            </CardContent>
          </Card>
        ) : (
          recentApplications.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{request.userName}</h4>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{request.userEmail}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted: {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setViewingRequest(request)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    
                    {request.status === 'pending' && (
                      <>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleStatusUpdate(request.id, 'approved')}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleStatusUpdate(request.id, 'denied')}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Deny
                        </Button>
                      </>
                    )}
                    
                    {request.status === 'approved' && false && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => revokeReviewerByEmail(request.userEmail)}
                      >
                        <UserX className="mr-1 h-3 w-3" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* View Request Details Dialog */}
      <Dialog open={!!viewingRequest} onOpenChange={(open) => {
        if (!open) setViewingRequest(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reviewer Request Details</DialogTitle>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Applicant</h4>
                <p className="text-sm">{viewingRequest.userName}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Email</h4>
                <p className="text-sm text-muted-foreground">{viewingRequest.userEmail}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Status</h4>
                {getStatusBadge(viewingRequest.status)}
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Submitted</h4>
                <p className="text-sm text-muted-foreground">
                  {new Date(viewingRequest.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">User ID</h4>
                <p className="text-xs text-muted-foreground font-mono">{viewingRequest.userId}</p>
              </div>
              
              {viewingRequest.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    onClick={() => {
                      handleStatusUpdate(viewingRequest!.id, 'approved');
                      setViewingRequest(null);
                    }}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Approve
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 border-red-600 hover:bg-red-50 flex-1"
                    onClick={() => {
                      handleStatusUpdate(viewingRequest!.id, 'denied');
                      setViewingRequest(null);
                    }}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Deny
                  </Button>
                </div>
              )}
              
              <div className="pt-2">
                <Button variant="outline" onClick={() => setViewingRequest(null)} className="w-full">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reviewer Invitations Section */}
      {activeInvitations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold font-headline">Reviewer Invitations</h3>
          
          {pendingInvitations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Pending Invitations</h4>
              {pendingInvitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{invitation.email}</h4>
                          <Badge variant="secondary" className="border-amber-600/40 bg-amber-500/10 text-amber-700">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Invited by {invitation.invitedByName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyInviteLink(invitation.token)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copy Link
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`/invite/reviewer/${invitation.token}`, '_blank')}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔴 DELETE BUTTON CLICKED! Event:', e);
                            console.log('🔴 Invitation data:', invitation);
                            console.log('🔴 Invitation ID:', invitation.id);
                            console.log('🔴 Invitation email:', invitation.email);
                            console.log('🔴 About to call deleteInvitation function...');
                            try {
                              await deleteInvitation(invitation.id, invitation.email);
                              console.log('🔴 deleteInvitation function completed successfully');
                            } catch (error) {
                              console.error('🔴 Error calling deleteInvitation:', error);
                            }
                          }}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* REMOVED: Accepted invitations section - these should be archived and not displayed */}
          {/* Accepted invitations are automatically archived when users accept them */}
          {/* Users who accepted invitations can be found in the Reviewer Management section */}
        </div>
      )}

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

              <div className="!mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Reviewers will need a Google account to sign in and accept the invitation. Support for other sign-in methods is coming soon.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateInvitation} 
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
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
