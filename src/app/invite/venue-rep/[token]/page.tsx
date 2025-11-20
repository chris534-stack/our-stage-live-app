'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getIdToken } from 'firebase/auth';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2, UserCheck, Mail, Calendar, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VenueRepresentativeInvitation } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import SocialSignInButtons from '@/components/auth/SocialSignInButtons';
import EmailAuthForm from '@/components/auth/EmailAuthForm';

export default function VenueRepInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<Omit<VenueRepresentativeInvitation, 'token'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [assignedVenueNames, setAssignedVenueNames] = useState<string[] | null>(null);

  useEffect(() => {
    if (token) {
      validateInvitation();
    }
  }, [token]);

  useEffect(() => {
    // Optionally resolve venue names for prettier display
    const resolveVenueNames = async () => {
      if (!invitation?.assignedVenueIds?.length) return;
      try {
        const db = getClientDb();
        const names: string[] = [];
        for (const id of invitation.assignedVenueIds) {
          const snap = await getDoc(doc(db, 'venues', id));
          if (snap.exists()) {
            const data = snap.data() as any;
            names.push(data.name || id);
          } else {
            names.push(id);
          }
        }
        setAssignedVenueNames(names);
      } catch (e) {
        // Non-fatal; fallback to IDs
        setAssignedVenueNames(null);
      }
    };
    resolveVenueNames();
  }, [invitation?.assignedVenueIds]);

  const validateInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invite/venue-rep/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to validate invitation');
      }
      const data = await response.json();
      setInvitation(data.invitation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!user) return;
    try {
      if (!invitation) return;
      if (!policyAccepted) {
        setError('Please accept the Venue Rep policy to continue.');
        return;
      }
      if (invitation.isUnbound) {
        if (!/^\d{4,10}$/.test(claimCode.trim())) {
          setError('Enter your short code to proceed.');
          return;
        }
        if ((invitation as any).claimCodeLocked) {
          setError('This invitation has been locked due to too many failed attempts.');
          return;
        }
      }
      setAccepting(true);
      const firebaseToken = await getIdToken(user);
      const response = await fetch(`/api/invite/venue-rep/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseToken, claimCode: claimCode || undefined, policyAcceptedVersion: policyAccepted ? 'v1' : undefined }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }
      const data = await response.json();
      router.push(data.redirectTo || '/');
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Not Found</h2>
            <p className="text-muted-foreground mb-4">This invitation link may be invalid or expired.</p>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const venuesDisplay = assignedVenueNames && assignedVenueNames.length > 0
    ? assignedVenueNames.join(', ')
    : (invitation.assignedVenueIds || []).join(', ');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <UserCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Create Your Venue Rep Account</CardTitle>
          <p className="text-muted-foreground max-w-sm mx-auto">
            You've been invited to manage events for specific venues on Our Stage Eugene.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Invited Email</p>
                <p className="text-sm text-muted-foreground">{invitation.isUnbound ? 'Unbound invite (any email allowed)' : invitation.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
              <UserCheck className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Assigned Venues</p>
                <p className="text-sm text-muted-foreground">{venuesDisplay}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Expires</p>
                <p className="text-sm text-muted-foreground">{new Date(invitation.expiresAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">What you'll get:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Create and update events for your assigned venues.</li>
              <li>Collaborate with admins to keep show info current.</li>
              <li>Help the community discover local performances.</li>
            </ul>
          </div>

          <div className="space-y-4 pt-4">
            {user ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>You're signed in as:</strong> {user.email}
                  </p>
                </div>

                {invitation.isUnbound && (
                  <div className="space-y-2">
                    <Label htmlFor="claim-code">Enter Short Code</Label>
                    <Input
                      id="claim-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="6-digit code"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value.replace(/\D/g, ''))}
                    />
                    {(invitation as any).claimCodeLocked && (
                      <p className="text-sm text-red-600">This invitation is locked due to too many failed attempts. Contact an admin.</p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    id="policy-accept"
                    type="checkbox"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                  />
                  <Label htmlFor="policy-accept" className="text-sm">I agree to the Venue Rep policy (v1)</Label>
                </div>

                <Button
                  onClick={acceptInvitation}
                  disabled={
                    accepting ||
                    !policyAccepted ||
                    (invitation.isUnbound && (!/^\d{4,10}$/.test(claimCode) || (invitation as any).claimCodeLocked))
                  }
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Accepting Invitation...
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" /> Accept Venue Rep Invitation
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <SocialSignInButtons
                  onError={(msg) => setError(msg)}
                  onSignedIn={() => { /* user state will update via AuthProvider */ }}
                  size="lg"
                  fullWidth
                  showGoogle
                  showApple={false}
                  showMicrosoft={false}
                  showFacebook={false}
                />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or use your email</span>
                  </div>
                </div>
                <EmailAuthForm onError={(msg) => setError(msg)} onSignedIn={() => { /* AuthProvider updates */ }} />
                <p className="text-xs text-muted-foreground text-center">Sign in to continue and accept the invitation.</p>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By accepting this invitation, you agree to manage events responsibly for your assigned venues.
          </p>
          <p className="text-xs text-center text-muted-foreground">
            Note: Creating a public profile is optional. You can set one up later from the profile icon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
