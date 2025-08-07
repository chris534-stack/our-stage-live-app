'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Eye, UserX, Star, Calendar, Mail, 
  MoreVertical, Shield, Activity, Loader2
} from 'lucide-react';
import type { UserProfile } from '@/lib/types';

interface ReviewerListProps {
  reviewers: (UserProfile & { reviewCount?: number; lastReviewDate?: string; createdAt?: string })[];
  searchQuery: string;
  onRefresh: () => void;
}

export function ReviewerList({ reviewers, searchQuery, onRefresh }: ReviewerListProps) {
  const [selectedReviewer, setSelectedReviewer] = useState<(UserProfile & { reviewCount?: number; lastReviewDate?: string; createdAt?: string }) | null>(null);
  const [processingReviewers, setProcessingReviewers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Filter reviewers based on search query
  const filteredReviewers = reviewers.filter(reviewer => 
    reviewer.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reviewer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleReviewerStatus = async (reviewerId: string, currentStatus: boolean) => {
    setProcessingReviewers(prev => new Set(prev).add(reviewerId));
    
    try {
      const response = await fetch('/api/admin/users/reviewer-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: reviewerId,
          isReviewer: !currentStatus
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update reviewer status');
      }
      
      toast({
        title: 'Success!',
        description: `Reviewer privileges ${!currentStatus ? 'granted' : 'revoked'} successfully.`,
      });
      
      onRefresh();
    } catch (err) {
      console.error('Error updating reviewer status:', err);
      toast({
        title: 'Error',
        description: 'Failed to update reviewer status.',
        variant: 'destructive',
      });
    } finally {
      setProcessingReviewers(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewerId);
        return newSet;
      });
    }
  };

  if (filteredReviewers.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'No reviewers match your search' : 'No active reviewers yet'}
          </p>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'Try adjusting your search terms' : 'Reviewers will appear here once applications are approved or invitations are accepted.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Reviewers ({filteredReviewers.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredReviewers.map((reviewer) => {
              const isProcessing = processingReviewers.has(reviewer.userId);
              
              return (
                <div key={reviewer.userId} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {reviewer.photoURL ? (
                          <img
                            src={reviewer.photoURL}
                            alt={reviewer.displayName || 'Reviewer'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                      
                      {/* Reviewer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold truncate">
                            {reviewer.displayName || 'Unknown Reviewer'}
                          </h4>
                          <Badge variant="secondary" className="border-green-600/40 bg-green-500/10 text-green-700">
                            <Shield className="mr-1 h-3 w-3" />
                            Reviewer
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2 truncate">
                          {reviewer.email}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Joined: {reviewer.createdAt ? new Date(reviewer.createdAt).toLocaleDateString() : 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {/* TODO: Add review count when available */}
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedReviewer(reviewer)}
                        className="flex-1 sm:flex-none"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        <span className="hidden sm:inline">View Profile</span>
                        <span className="sm:hidden">View</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleToggleReviewerStatus(reviewer.userId, reviewer.isReviewer || false)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-none text-red-600 border-red-600 hover:bg-red-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <UserX className="mr-1 h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">Revoke Access</span>
                        <span className="sm:hidden">Revoke</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reviewer Profile Dialog */}
      <Dialog open={!!selectedReviewer} onOpenChange={(open) => {
        if (!open) setSelectedReviewer(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reviewer Profile</DialogTitle>
          </DialogHeader>
          {selectedReviewer && (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                {selectedReviewer.photoURL ? (
                  <img
                    src={selectedReviewer.photoURL}
                    alt={selectedReviewer.displayName || 'Reviewer'}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {selectedReviewer.displayName || 'Unknown Reviewer'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedReviewer.email}
                  </p>
                </div>
              </div>
              
              {/* Profile Details */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Role in Community</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedReviewer.roleInCommunity || 'Not specified'}
                  </p>
                </div>
                
                {selectedReviewer.bio && (
                  <div>
                    <h4 className="font-medium mb-1">Bio</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedReviewer.bio}
                    </p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium mb-1">Status</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="border-green-600/40 bg-green-500/10 text-green-700">
                      <Shield className="mr-1 h-3 w-3" />
                      Active Reviewer
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">Member Since</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedReviewer.createdAt ? new Date(selectedReviewer.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleToggleReviewerStatus(selectedReviewer.userId, selectedReviewer.isReviewer || false)}
                  disabled={processingReviewers.has(selectedReviewer.userId)}
                  className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                >
                  {processingReviewers.has(selectedReviewer.userId) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserX className="mr-2 h-4 w-4" />
                  )}
                  Revoke Access
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedReviewer(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
