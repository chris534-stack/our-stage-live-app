'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoogleAuthProvider, signInWithPopup, getIdToken, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2, UserCheck, Mail, Calendar, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReviewerInvitation } from '@/lib/types';

const GoogleIcon = (props: { className?: string }) => (
  <Image 
    src="/google-logo.png" 
    alt="Google logo" 
    width={24} 
    height={24}
    className={props.className}
    data-ai-hint="google logo"
  />
);

export default function ReviewerInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<Omit<ReviewerInvitation, 'token'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleSignIn = async () => {
    if (!auth) {
      setError('Authentication service is not available. Please try again later.');
      return;
    }
    try {
      setAccepting(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // The useEffect will handle accepting the invitation once user is signed in
    } catch (error) {
      console.error('Error signing in:', error);
      setError('Failed to sign in with Google. Please try again.');
      setAccepting(false);
    }
  };

  const handleSignUpWithEmail = async () => {
    if (!email || password.length < 6) {
        setError("Please provide a valid email and a password of at least 6 characters.");
        return;
    }
    if (!auth) {
      setError('Authentication service is not available. Please try again later.');
      return;
    }
    try {
      setAccepting(true);
      await createUserWithEmailAndPassword(auth, email, password);
      // The useEffect hook will handle accepting the invitation once user is created and signed in
    } catch (error: any) { // Using 'any' for Firebase auth errors
      console.error('Error signing up:', error);
      if (error.code === 'auth/email-already-in-use') {
          setError('This email is already in use. Please sign in or use a different email.');
      } else {
          setError('Failed to create account. Please try again.');
      }
      setAccepting(false);
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
      
      // Success! Redirect to profile or dashboard
      router.push(data.redirectTo || '/profile');
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
              <>
                <Button 
                  onClick={handleSignIn} 
                  disabled={accepting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  {accepting && !password ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </> 
                  ) : (
                    <>
                      <GoogleIcon className="mr-2 h-4 w-4" />
                      Sign in with Google to Accept
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or create an account with
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="6+ characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button onClick={handleSignUpWithEmail} disabled={accepting || !email || password.length < 6} className="w-full">
                  {accepting && password ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</>
                  ) : (
                      'Create Account & Accept'
                  )}
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By accepting this invitation, you agree to write thoughtful, honest reviews 
            that help our community discover great theatre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
