'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { getClientAuth } from '@/lib/firebase';
import { GoogleAuthProvider, OAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';

export type SocialSignInButtonsProps = {
  onSignedIn?: () => void;
  onError?: (message: string) => void;
  size?: 'default' | 'lg' | 'sm';
  fullWidth?: boolean;
  className?: string;
  showGoogle?: boolean;
  showApple?: boolean;
  showMicrosoft?: boolean;
  showFacebook?: boolean;
};

const GoogleIcon = (props: { className?: string }) => (
  <Image src="/google-logo.png" alt="Google logo" width={24} height={24} className={props.className} />
);

// Simple text glyphs to avoid missing icon packages; can be swapped for brand SVGs later
const AppleGlyph = ({ className }: { className?: string }) => (
  <span className={className} aria-hidden></span>
);
const MicrosoftGlyph = ({ className }: { className?: string }) => (
  <span className={className} aria-hidden>⊞</span>
);

// Minimal brand glyphs; replace with SVGs if desired
const FacebookGlyph = ({ className }: { className?: string }) => (
  <span className={className} aria-hidden>f</span>
);

export default function SocialSignInButtons({ onSignedIn, onError, size = 'default', fullWidth = true, className, showGoogle = true, showApple = true, showMicrosoft = true, showFacebook = true }: SocialSignInButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSignIn = async (providerId: 'google' | 'apple' | 'microsoft' | 'facebook') => {
    try {
      setLoadingProvider(providerId);
      const auth = getClientAuth();
      let provider;
      if (providerId === 'google') {
        provider = new GoogleAuthProvider();
      } else if (providerId === 'apple') {
        provider = new OAuthProvider('apple.com');
        // Request email and name when available (name only on first auth)
        provider.addScope('email');
        provider.addScope('name');
      } else if (providerId === 'microsoft') {
        provider = new OAuthProvider('microsoft.com');
        // Basic profile/email
        provider.addScope('User.Read');
      } else {
        provider = new FacebookAuthProvider();
        // Request email
        provider.addScope('email');
      }
      try {
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        // Fallback to redirect if popups are blocked or environment doesn't support popups
        const code = err?.code || '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return; // Redirecting; no further actions
        }
        throw err;
      }
      onSignedIn?.();
    } catch (e: any) {
      console.error(`Error signing in with ${providerId}:`, e);
      const msg = e?.message || 'Sign-in failed. Please try again.';
      onError?.(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const btnClass = `${fullWidth ? 'w-full' : ''} ${className || ''}`.trim();

  return (
    <div className="grid grid-cols-1 gap-2">
      {showGoogle && (
        <Button onClick={() => handleSignIn('google')} size={size} className={btnClass} disabled={!!loadingProvider}>
          {loadingProvider === 'google' ? (
            'Signing in...'
          ) : (
            <>
              <GoogleIcon className="mr-2 h-5 w-5" /> Sign in with Google
            </>
          )}
        </Button>
      )}
      {showApple && (
        <Button onClick={() => handleSignIn('apple')} size={size} variant="outline" className={btnClass} disabled={!!loadingProvider}>
          {loadingProvider === 'apple' ? (
            'Signing in...'
          ) : (
            <>
              <AppleGlyph className="mr-2 text-lg leading-none" /> Sign in with Apple
            </>
          )}
        </Button>
      )}
      {showMicrosoft && (
        <Button onClick={() => handleSignIn('microsoft')} size={size} variant="outline" className={btnClass} disabled={!!loadingProvider}>
          {loadingProvider === 'microsoft' ? (
            'Signing in...'
          ) : (
            <>
              <MicrosoftGlyph className="mr-2 text-lg leading-none" /> Sign in with Microsoft
            </>
          )}
        </Button>
      )}
      {showFacebook && (
        <Button onClick={() => handleSignIn('facebook')} size={size} variant="outline" className={btnClass} disabled={!!loadingProvider}>
          {loadingProvider === 'facebook' ? (
            'Signing in...'
          ) : (
            <>
              <FacebookGlyph className="mr-2 text-lg leading-none" /> Sign in with Facebook
            </>
          )}
        </Button>
      )}
    </div>
  );
}

