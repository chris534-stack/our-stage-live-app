'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SocialSignInButtons from '@/components/auth/SocialSignInButtons';
import EmailAuthForm from '@/components/auth/EmailAuthForm';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/profile');
    }
  }, [user, loading, router]);

  // Sign-in handled by SocialSignInButtons

  if (loading || user) {
    return <div className="flex flex-1 items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-secondary">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Join Our Stage</CardTitle>
          <CardDescription>Sign in or create an account to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center w-full gap-4">
          <div className="w-full max-w-xs">
            <SocialSignInButtons
              onSignedIn={() => router.push('/profile')}
              onError={(msg) => console.error('Sign-in error:', msg)}
              size="lg"
              fullWidth
              showGoogle
              showApple={false}
              showMicrosoft={false}
              showFacebook={false}
            />
          </div>
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or use your email</span>
            </div>
          </div>
          <div className="w-full max-w-xs">
            <EmailAuthForm onSignedIn={() => router.push('/profile')} onError={(m) => console.error(m)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
