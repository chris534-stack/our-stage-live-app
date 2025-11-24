'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getAuth,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';

export type EmailAuthFormProps = {
  onSignedIn?: () => void;
  onError?: (message: string) => void;
  defaultEmail?: string;
  className?: string;
  // If provided, use this URL for passwordless return; otherwise use current URL
  returnUrlOverride?: string;
};

type Mode = 'signin' | 'signup' | 'passwordless' | 'reset';

export default function EmailAuthForm({ onSignedIn, onError, defaultEmail, className, returnUrlOverride }: EmailAuthFormProps) {
  const auth = getClientAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Handle email-link completion if the page loads with an email link
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (!isSignInWithEmailLink(auth, window.location.href)) return;

      // Try to get email from localStorage (set when sending link)
      const storedEmail = typeof window !== 'undefined' ? window.localStorage.getItem('emailForSignIn') : null;
      if (storedEmail) {
        setEmail(storedEmail);
      } else {
        // If not found, switch the UI to passwordless mode and ask for email
        setMode('passwordless');
        setMessage('Please enter your email to complete sign-in.');
      }
    } catch {
      // ignore
    }
  }, [auth]);

  const actionCodeSettings = useMemo(() => {
    const url = returnUrlOverride || (typeof window !== 'undefined' ? window.location.href.split('#')[0] : '');
    return {
      url,
      handleCodeInApp: true,
    } as const;
  }, [returnUrlOverride]);

  const handleError = (e: any, fallback = 'Authentication failed. Please try again.') => {
    console.error(e);
    const msg = e?.message || fallback;
    onError?.(msg);
    setMessage(msg);
  };

  const doSignIn = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setMessage(null);
      onSignedIn?.();
    } catch (e) {
      handleError(e, 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const doSignUp = async () => {
    try {
      if (password.length < 6) {
        setMessage('Password must be at least 6 characters.');
        return;
      }
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Proactively send verification email for new accounts
      try {
        const current = getClientAuth().currentUser;
        if (current && !current.emailVerified) {
          await sendEmailVerification(current);
          setMessage('Verification email sent. Please check your inbox to verify your email address.');
        } else {
          setMessage(null);
        }
      } catch (verr) {
        // Non-fatal: account created, but verification email failed to send
        console.error('Failed to send verification email', verr);
        setMessage('Account created, but failed to send verification email. You can request a new verification from your profile.');
      }
      onSignedIn?.();
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        setMessage('This email is already in use. Try signing in or resetting your password.');
      } else {
        handleError(e, 'Failed to create account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const sendLink = async () => {
    try {
      setLoading(true);
      await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('emailForSignIn', email.trim());
      }
      setMessage('Sign-in link sent. Check your email and open the link on this device.');
    } catch (e) {
      handleError(e, 'Failed to send sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  const completeLink = async () => {
    try {
      setLoading(true);
      await signInWithEmailLink(auth, email.trim(), typeof window !== 'undefined' ? window.location.href : '');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('emailForSignIn');
      }
      setMessage(null);
      onSignedIn?.();
    } catch (e) {
      handleError(e, 'Failed to complete email link sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    try {
      setLoading(true);
      const addr = email.trim();
      // Check what providers are linked to the email to avoid misleading UX
      const methods = await fetchSignInMethodsForEmail(auth, addr);
      if (!methods.includes('password')) {
        // Likely a federated-only account (e.g., Google). Firebase typically won't send a reset email.
        // Guide the user to use email link or sign in with their provider and set a password from profile.
        setMessage(
          'This email may not have a password set (e.g., signed in with Google). Use Email link to sign in, or sign in with your provider and set a password in your profile.'
        );
        setMode('passwordless');
        return;
      }
      await sendPasswordResetEmail(auth, addr);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (e) {
      handleError(e, 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex justify-center gap-2 mb-3 text-xs">
        <button className={`underline-offset-4 ${mode === 'signin' ? 'font-semibold' : 'text-muted-foreground'} underline`} onClick={() => setMode('signin')}>Sign in</button>
        <span>·</span>
        <button className={`underline-offset-4 ${mode === 'signup' ? 'font-semibold' : 'text-muted-foreground'} underline`} onClick={() => setMode('signup')}>Create account</button>
        <span>·</span>
        <button className={`underline-offset-4 ${mode === 'passwordless' ? 'font-semibold' : 'text-muted-foreground'} underline`} onClick={() => setMode('passwordless')}>Email link</button>
        <span>·</span>
        <button className={`underline-offset-4 ${mode === 'reset' ? 'font-semibold' : 'text-muted-foreground'} underline`} onClick={() => setMode('reset')}>Reset</button>
      </div>

      {message && (
        <p className="text-xs mb-2 text-muted-foreground">{message}</p>
      )}

      {(mode === 'signin' || mode === 'signup') && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="6+ characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button className="w-full" disabled={loading || !email || password.length < 6} onClick={mode === 'signin' ? doSignIn : doSignUp}>
            {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </Button>
        </div>
      )}

      {mode === 'passwordless' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="emailLink">Email</Label>
            <Input id="emailLink" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {typeof window !== 'undefined' && isSignInWithEmailLink(auth, window.location.href) ? (
            <Button className="w-full" disabled={loading || !email} onClick={completeLink}>
              {loading ? 'Completing…' : 'Complete sign-in'}
            </Button>
          ) : (
            <Button className="w-full" disabled={loading || !email} onClick={sendLink}>
              {loading ? 'Sending…' : 'Send sign-in link'}
            </Button>
          )}
        </div>
      )}

      {mode === 'reset' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="emailReset">Email</Label>
            <Input id="emailReset" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button className="w-full" disabled={loading || !email} onClick={sendReset}>
            {loading ? 'Sending…' : 'Send reset email'}
          </Button>
        </div>
      )}
    </div>
  );
}
