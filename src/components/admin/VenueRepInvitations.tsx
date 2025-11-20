'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Clock, Mail, Copy, ExternalLink, Trash2, Send, Loader2, UserCog, RefreshCw, Plus, Lock } from 'lucide-react';
import type { Venue, VenueRepresentativeInvitation } from '@/lib/types';

interface VenueRepInvitationsProps {
  venues: Venue[];
  autoOpenInvite?: boolean;
  hideInviteButton?: boolean;
}

export function VenueRepInvitations({ venues, autoOpenInvite, hideInviteButton }: VenueRepInvitationsProps) {
  const [invitations, setInvitations] = useState<VenueRepresentativeInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite dialog state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [isUnbound, setIsUnbound] = useState(false);
  const [codeLength, setCodeLength] = useState(6);
  const [codeMaxAttempts, setCodeMaxAttempts] = useState(5);
  const [ttlHours, setTtlHours] = useState<number | ''>(72);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [createdClaimCode, setCreatedClaimCode] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [rotatedCode, setRotatedCode] = useState<string | null>(null);

  const { toast } = useToast();

  const venuesById = useMemo(() => {
    const map: Record<string, Venue> = {};
    for (const v of venues) map[v.id] = v;
    return map;
  }, [venues]);

  useEffect(() => {
    fetchInvitations();
  }, []);

  // Auto-open invite dialog when navigated with invite=1
  useEffect(() => {
    if (autoOpenInvite) {
      setShowInviteDialog(true);
    }
  }, [autoOpenInvite]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/venue-rep-invitations');
      if (!response.ok) throw new Error('Failed to fetch venue rep invitations');
      const data = await response.json();
      setInvitations((data.invitations || []) as VenueRepresentativeInvitation[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venue rep invitations');
    } finally {
      setLoading(false);
    }
  };

  const pendingInvitations = useMemo(
    () => (invitations || []).filter((i) => i.status === 'pending' && !i.archived),
    [invitations]
  );
  const expiredInvitations = useMemo(
    () => (invitations || []).filter((i) => i.status === 'expired' && !i.archived),
    [invitations]
  );

  const copyInviteLink = async (token: string) => {
    const inviteLink = `${window.location.origin}/invite/venue-rep/${token}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: 'Link Copied', description: 'Invitation link copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const rotateClaimCode = async (invitationId: string) => {
    try {
      setRotating(true);
      const response = await fetch('/api/admin/venue-rep-invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action: 'rotateClaimCode' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to rotate code');
      setRotatedCode(data.claimCode || null);
      setShowRotateDialog(true);
      await fetchInvitations();
      toast({ title: 'Code Rotated', description: 'New short code generated.' });
      try {
        if (navigator.clipboard && data.claimCode) {
          await navigator.clipboard.writeText(data.claimCode);
        }
      } catch {}
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to rotate code.',
        variant: 'destructive',
      });
    } finally {
      setRotating(false);
    }
  };

  const deleteInvitation = async (invitationId: string, email: string) => {
    try {
      const response = await fetch(`/api/admin/venue-rep-invitations?id=${encodeURIComponent(invitationId)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete invitation');
      await fetchInvitations();
      toast({ title: 'Invitation Deleted', description: `Deleted invitation for ${email}.` });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete invitation.',
        variant: 'destructive',
      });
    }
  };

  const handleVenueToggle = (venueId: string, checked: boolean) => {
    setSelectedVenueIds((prev) => (checked ? [...prev, venueId] : prev.filter((id) => id !== venueId)));
  };

  const handleCreateInvitation = async () => {
    if (!isUnbound) {
      if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
        toast({ title: 'Error', description: 'Enter a valid email address.', variant: 'destructive' });
        return;
      }
    }
    if (selectedVenueIds.length === 0) {
      toast({ title: 'Error', description: 'Select at least one venue.', variant: 'destructive' });
      return;
    }

    try {
      setInviting(true);
      const payload: any = { assignedVenueIds: selectedVenueIds };
      if (isUnbound) {
        payload.isUnbound = true;
        payload.claimCodeLength = Math.max(4, Math.min(10, Number(codeLength) || 6));
        payload.claimCodeMaxAttempts = Math.max(1, Number(codeMaxAttempts) || 5);
        if (ttlHours && Number(ttlHours) > 0) payload.ttlHours = Number(ttlHours);
      } else {
        payload.email = inviteEmail.trim();
      }

      const response = await fetch('/api/admin/venue-rep-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create invitation');

      if (isUnbound && data.claimCode) {
        setCreatedClaimCode(data.claimCode);
        setCreatedInviteLink(data.inviteLink || null);
        setShowCreatedDialog(true);
        toast({ title: 'Unbound Invite Created', description: 'Short code generated. Copy and share securely.' });
      } else {
        // Copy link to clipboard for email-bound invites
        if (navigator.clipboard && data.inviteLink) {
          await navigator.clipboard.writeText(data.inviteLink);
          toast({ title: 'Invitation Created', description: 'Link copied to clipboard.' });
        } else {
          toast({ title: 'Invitation Created', description: 'Venue rep invitation created.' });
        }
      }

      // Reset form and refresh list
      setInviteEmail('');
      setSelectedVenueIds([]);
      setIsUnbound(false);
      setCodeLength(6);
      setCodeMaxAttempts(5);
      setTtlHours(72);
      setShowInviteDialog(false);
      await fetchInvitations();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create invitation.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-headline mb-2">Venue Representatives</h2>
          <p className="text-muted-foreground">Manage invitations and access for venue representatives</p>
        </div>
        {!hideInviteButton && (
          <Button onClick={() => setShowInviteDialog(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Invite Venue Rep
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6 md:h-8 md:w-8 text-amber-600" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{pendingInvitations.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">Pending Invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {expiredInvitations.length > 0 && (
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
                <div>
                  <p className="text-xl md:text-2xl font-bold">{expiredInvitations.length}</p>
                  <p className="text-xs md:text-sm text-muted-foreground leading-tight">Expired Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Pending Venue Rep Invitations</h3>
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">Loading venue representative invitations...</div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <div className="text-red-600">Error: {error}</div>
              <Button onClick={fetchInvitations} variant="outline" size="sm">Retry</Button>
            </CardContent>
          </Card>
        ) : pendingInvitations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No pending venue representative invitations</p>
              <p className="text-xs text-muted-foreground">Create a new invitation to grant venue access.</p>
            </CardContent>
          </Card>
        ) : (
          pendingInvitations.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 min-w-0">
                      <h4 className="font-semibold truncate">{inv.isUnbound ? 'Unbound invite (any email allowed)' : inv.email}</h4>
                      <Badge variant="secondary" className="border-amber-600/40 bg-amber-500/10 text-amber-700">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                      {inv.isUnbound && (
                        <Badge variant="secondary" className="border-blue-600/40 bg-blue-500/10 text-blue-700">
                          Unbound
                        </Badge>
                      )}
                      {inv.isUnbound && (inv as any).claimCodeLocked && (
                        <Badge variant="secondary" className="border-red-600/40 bg-red-500/10 text-red-700">
                          <Lock className="mr-1 h-3 w-3" /> Locked
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {inv.assignedVenueIds?.map((id) => (
                        <Badge key={id} variant="outline" className="text-xs">
                          {venuesById[id]?.name || id}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {inv.isUnbound && (
                      <Button variant="outline" size="sm" onClick={() => rotateClaimCode(inv.id)} disabled={rotating}>
                        <RefreshCw className="mr-1 h-3 w-3" /> Rotate Code
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => copyInviteLink(inv.token)}>
                      <Copy className="mr-1 h-3 w-3" /> Copy Link
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/invite/venue-rep/${inv.token}`, '_blank')}>
                      <ExternalLink className="mr-1 h-3 w-3" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      onClick={() => deleteInvitation(inv.id, inv.email)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Invite Venue Rep Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Venue Representative</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="unbound-switch">Unbound invite (use short code)</Label>
              <Switch id="unbound-switch" checked={isUnbound} onCheckedChange={(v) => setIsUnbound(v === true)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-rep-email">Email Address</Label>
              <Input
                id="venue-rep-email"
                type="email"
                placeholder="venuerep@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isUnbound}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !inviting) handleCreateInvitation();
                }}
              />
              {isUnbound && (
                <p className="text-xs text-muted-foreground">Email not required for unbound invites.</p>
              )}
            </div>

            {isUnbound && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="code-length">Code Length</Label>
                  <Input
                    id="code-length"
                    type="number"
                    min={4}
                    max={10}
                    value={codeLength}
                    onChange={(e) => setCodeLength(Math.max(4, Math.min(10, Number(e.target.value) || 6)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-attempts">Max Attempts</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min={1}
                    value={codeMaxAttempts}
                    onChange={(e) => setCodeMaxAttempts(Math.max(1, Number(e.target.value) || 5))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttl-hours">TTL (hours)</Label>
                  <Input
                    id="ttl-hours"
                    type="number"
                    min={1}
                    value={ttlHours}
                    onChange={(e) => setTtlHours(Math.max(1, Number(e.target.value) || 72))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Assigned Venues</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                {venues.map((venue) => (
                  <div key={venue.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`venue-${venue.id}`}
                      checked={selectedVenueIds.includes(venue.id)}
                      onCheckedChange={(checked) => handleVenueToggle(venue.id, checked === true)}
                    />
                    <Label htmlFor={`venue-${venue.id}`} className="text-sm font-normal cursor-pointer flex-1">
                      {venue.name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select venues this representative can manage events for.</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateInvitation}
                disabled={
                  inviting ||
                  selectedVenueIds.length === 0 ||
                  (!isUnbound && !inviteEmail.trim())
                }
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Create {isUnbound ? 'Unbound ' : ''}Invitation
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteEmail('');
                  setSelectedVenueIds([]);
                  setIsUnbound(false);
                  setCodeLength(6);
                  setCodeMaxAttempts(5);
                  setTtlHours(72);
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

      {/* Post-create dialog for unbound invites */}
      <Dialog open={showCreatedDialog} onOpenChange={setShowCreatedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unbound Invite Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this link and short code with the invitee. The code is shown only once.</p>
            <div className="space-y-2">
              <Label>Short Code</Label>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-mono tracking-widest px-3 py-2 rounded-md bg-muted flex-1 text-center">
                  {createdClaimCode}
                </div>
                <Button
                  variant="outline"
                  onClick={async () => { if (createdClaimCode) { try { await navigator.clipboard.writeText(createdClaimCode); toast({ title: 'Code Copied' }); } catch {} } }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={createdInviteLink || ''} />
                <Button
                  variant="outline"
                  onClick={async () => { if (createdInviteLink) { try { await navigator.clipboard.writeText(createdInviteLink); toast({ title: 'Link Copied' }); } catch {} } }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
            <div className="pt-2">
              <Button className="w-full" onClick={() => setShowCreatedDialog(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rotate code result dialog */}
      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Short Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this new code with the invitee. The previous code is now invalid.</p>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-mono tracking-widest px-3 py-2 rounded-md bg-muted flex-1 text-center">
                {rotatedCode}
              </div>
              <Button
                variant="outline"
                onClick={async () => { if (rotatedCode) { try { await navigator.clipboard.writeText(rotatedCode); toast({ title: 'Code Copied' }); } catch {} } }}
              >
                <Copy className="mr-1 h-4 w-4" /> Copy
              </Button>
            </div>
            <div className="pt-2">
              <Button className="w-full" onClick={() => setShowRotateDialog(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
