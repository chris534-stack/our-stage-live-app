'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getIdToken } from 'firebase/auth';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2, UserCheck, Mail, Calendar, AlertCircle } from 'lucide-react';
import type { ReviewerInvitation } from '@/lib/types';
import SocialSignInButtons from '@/components/auth/SocialSignInButtons';
import EmailAuthForm from '@/components/auth/EmailAuthForm';

export default function ReviewerInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<Omit<ReviewerInvitation, 'token'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (token) {
      validateInvitation();
    }
  }, [token]);

  // Removed automatic invitation acceptance for privacy/consent reasons
  // Users must explicitly click to accept invitations

  const validateInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invite/reviewer/${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to validate invitation');
      }

      const data = await response.json();
      setInvitation(data.invitation);
      setEmail(data.invitation.email); // Pre-fill email from invitation
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!user) return;

    try {
      setAccepting(true);
      const firebaseToken = await getIdToken(user); // No type change needed here, user is from useAuth
      
      const response = await fetch(`/api/invite/reviewer/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firebaseToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();
      
      // Success! Redirect home by default; profile setup is optional
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
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
              className="w-full"
            >
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
            <p className="text-muted-foreground mb-4">
              This invitation link may be invalid or expired.
            </p>
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <UserCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Create Your Reviewer Account
          </CardTitle>
          <p className="text-muted-foreground max-w-sm mx-auto">
            You've been invited to join Our Stage and share reviews for the local Eugene community theatre scene.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Invited Email</p>
                <p className="text-sm text-muted-foreground">{invitation.email}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
              <UserCheck className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Invited By</p>
                <p className="text-sm text-muted-foreground">{invitation.invitedByName}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Expires</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">What you'll get:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Write and share reviews of local theatre productions.</li>
              <li>Help community members discover great shows.</li>
              <li>Contribute to Eugene's vibrant arts community.</li>
            </ul>
          </div>

          <div className="space-y-4 pt-4">
            {user ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>You're signed in as:</strong> {user.email}
                  </p>
                </div>
                <Button 
                  onClick={acceptInvitation} 
                  disabled={accepting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting Invitation...
                    </> 
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Accept Reviewer Invitation
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <SocialSignInButtons
                  onError={(msg) => setError(msg)}
                  onSignedIn={() => { /* user state updates via AuthProvider */ }}
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
                <EmailAuthForm defaultEmail={email} onError={(msg) => setError(msg)} onSignedIn={() => { /* AuthProvider updates */ }} />
              </div>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By accepting this invitation, you agree to write thoughtful, honest reviews 
            that help our community discover great theatre.
          </p>
          <p className="text-xs text-center text-muted-foreground">
            Note: Creating a public profile is optional. You can set one up later from the profile icon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
