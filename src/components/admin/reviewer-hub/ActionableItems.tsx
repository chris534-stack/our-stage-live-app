'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, Mail, Eye, CheckCircle, XCircle, Copy, ExternalLink, 
  Trash2, Loader2, Calendar, User
} from 'lucide-react';
import type { ReviewerRequest, ReviewerInvitation } from '@/lib/types';

type ActionableItem = (ReviewerRequest | ReviewerInvitation) & {
  type: 'application' | 'invitation';
};

interface ActionableItemsProps {
  items: ActionableItem[];
  onRefresh: () => void;
}

export function ActionableItems({ items, onRefresh }: ActionableItemsProps) {
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleApplicationAction = async (id: string, action: 'approved' | 'denied') => {
    setProcessingItems(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch(`/api/admin/reviewer-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} application`);
      }
      
      // If approved, archive the application
      if (action === 'approved') {
        await fetch(`/api/admin/reviewer-requests/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: true }),
        });
      }
      
      toast({
        title: 'Success!',
        description: `Application ${action} successfully.`,
      });
      
      onRefresh();
    } catch (err) {
      console.error(`Error ${action}ing application:`, err);
      toast({
        title: 'Error',
        description: `Failed to ${action} application.`,
        variant: 'destructive',
      });
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleInvitationAction = async (id: string, action: 'copy' | 'delete') => {
    const item = items.find(i => i.id === id && i.type === 'invitation') as ReviewerInvitation;
    if (!item) return;

    if (action === 'copy') {
      const inviteLink = `${window.location.origin}/invite/reviewer/${item.token}`;
      try {
        await navigator.clipboard.writeText(inviteLink);
        toast({
          title: 'Link Copied!',
          description: 'Invitation link copied to clipboard.',
        });
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to copy link to clipboard.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (action === 'delete') {
      setProcessingItems(prev => new Set(prev).add(id));
      
      try {
        const response = await fetch(`/api/admin/reviewer-invitations?id=${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete invitation');
        }
        
        toast({
          title: 'Invitation Deleted',
          description: 'Invitation has been deleted successfully.',
        });
        
        onRefresh();
      } catch (err) {
        console.error('Error deleting invitation:', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to delete invitation.',
          variant: 'destructive',
        });
      } finally {
        setProcessingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        🎉 All caught up! No pending actions required.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isProcessing = processingItems.has(item.id);
        
        if (item.type === 'application') {
          const app = item as ReviewerRequest;
          return (
            <Card key={item.id} className="border-l-4 border-l-yellow-400">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <h4 className="font-semibold truncate">{app.userName}</h4>
                      <Badge variant="secondary" className="border-yellow-600/40 bg-yellow-500/10 text-yellow-700">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1 truncate">{app.userEmail}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleApplicationAction(app.id, 'approved')}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none bg-green-50 border-green-600 text-green-700 hover:bg-green-100"
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      )}
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleApplicationAction(app.id, 'denied')}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none bg-red-50 border-red-600 text-red-700 hover:bg-red-100"
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Deny
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        } else {
          const invitation = item as ReviewerInvitation;
          const expiresAt = new Date(invitation.expiresAt);
          const isExpiringSoon = expiresAt.getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000; // 2 days
          
          return (
            <Card key={item.id} className="border-l-4 border-l-amber-400">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <h4 className="font-semibold truncate">{invitation.email}</h4>
                      <Badge variant="secondary" className="border-amber-600/40 bg-amber-500/10 text-amber-700">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Invited by {invitation.invitedByName || 'Admin'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Expires: {expiresAt.toLocaleDateString()}
                      </span>
                      {isExpiringSoon && (
                        <Badge variant="destructive" className="text-xs">
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleInvitationAction(invitation.id, 'copy')}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy Link
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`/invite/reviewer/${invitation.token}`, '_blank')}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleInvitationAction(invitation.id, 'delete')}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none text-red-600 border-red-600 hover:bg-red-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-3 w-3" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
      })}
    </div>
  );
}
