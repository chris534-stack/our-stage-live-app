'use client';

import * as React from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth, getClientDb } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  isVenueRep: boolean;
  assignedVenueIds: string[];
  hasSeenVenueRepIntro: boolean;
  venueRepOnboardingCompleted: boolean;
  venueRepPolicyAccepted?: boolean;
  venueRepPolicyAcceptedVersion?: string | null;
  setHasSeenVenueRepIntro?: () => Promise<void>;
  setVenueRepOnboardingCompleted?: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isReviewer: false,
  isVenueRep: false,
  assignedVenueIds: [],
  hasSeenVenueRepIntro: false,
  venueRepOnboardingCompleted: false,
  venueRepPolicyAccepted: false,
  venueRepPolicyAcceptedVersion: null,
});

// --- FOR TESTING: To skip the login page, provide a mock user object here. ---
// --- To return to normal behavior, set MOCK_USER to null. ---
// --- DO NOT DEPLOY WITH A MOCK USER. ---
const MOCK_USER: User | null = null;


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isReviewer, setIsReviewer] = React.useState(false);
  const [isVenueRep, setIsVenueRep] = React.useState(false);
  const [assignedVenueIds, setAssignedVenueIds] = React.useState<string[]>([]);
  const [hasSeenVenueRepIntro, setHasSeenVenueRepIntroState] = React.useState(false);
  const [venueRepOnboardingCompleted, setVenueRepOnboardingCompletedState] = React.useState(false);
  const [venueRepPolicyAccepted, setVenueRepPolicyAccepted] = React.useState<boolean>(false);
  const [venueRepPolicyAcceptedVersion, setVenueRepPolicyAcceptedVersion] = React.useState<string | null>(null);

  React.useEffect(() => {
    // --- DEVELOPMENT OVERRIDE TO SKIP LOGIN ---
    if (MOCK_USER) {
        setUser(MOCK_USER);
        // For testing, the mock user is both an admin and a reviewer
        setIsAdmin(true);
        setIsReviewer(true);
        setIsVenueRep(true);
        setAssignedVenueIds(['mock-venue']);
        setHasSeenVenueRepIntroState(false);
        setVenueRepOnboardingCompletedState(false);
        setLoading(false);
        return; // Skip the real auth listener
    }
    // --- END OVERRIDE ---

    const unsubscribe = onAuthStateChanged(getClientAuth(), (user) => {
      setUser(user);

      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const reviewerEmails = (process.env.NEXT_PUBLIC_REVIEWER_EMAILS || '').split(',').filter(e => e);

      if (user) {
        // Admin Check
        if (adminEmail) {
          setIsAdmin(!!user && user.email === adminEmail);
        } else {
          // If not configured, any signed-in user is an admin for testing.
          setIsAdmin(true); 
        }

        // Reviewer Check (env baseline, will be overridden by userProfiles if present)
        const reviewerFromEnv = reviewerEmails.length > 0
          ? reviewerEmails.includes(user.email || '')
          : true; // if no list configured, default-allow in dev
        setIsReviewer(reviewerFromEnv);

        // Venue Rep flags from userProfiles
        (async () => {
          try {
            const db = getClientDb();
            const profileSnap = await getDoc(doc(db, 'userProfiles', user.uid));
            if (profileSnap.exists()) {
              const data = profileSnap.data() as any;
              setIsVenueRep(!!data.isVenueRep);
              setAssignedVenueIds(Array.isArray(data.assignedVenueIds) ? data.assignedVenueIds : []);
              setHasSeenVenueRepIntroState(!!data.hasSeenVenueRepIntro);
              setVenueRepOnboardingCompletedState(!!data.venueRepOnboardingCompleted);
              setVenueRepPolicyAccepted(!!data.venueRepPolicyAccepted);
              setVenueRepPolicyAcceptedVersion(data.venueRepPolicyAcceptedVersion || null);
              // Override reviewer flag if profile says so
              if (data.isReviewer === true) {
                setIsReviewer(true);
              }
            } else {
              setIsVenueRep(false);
              setAssignedVenueIds([]);
              setHasSeenVenueRepIntroState(false);
              setVenueRepOnboardingCompletedState(false);
              setVenueRepPolicyAccepted(false);
              setVenueRepPolicyAcceptedVersion(null);
              // Keep env-derived reviewer flag if no profile exists
            }
          } catch (err) {
            console.error('Failed to load user profile for venue rep flags', err);
            setIsVenueRep(false);
            setAssignedVenueIds([]);
            setHasSeenVenueRepIntroState(false);
            setVenueRepOnboardingCompletedState(false);
            setVenueRepPolicyAccepted(false);
            setVenueRepPolicyAcceptedVersion(null);
          }
        })();

      } else {
        setIsAdmin(false);
        setIsReviewer(false);
        setIsVenueRep(false);
        setAssignedVenueIds([]);
        setHasSeenVenueRepIntroState(false);
        setVenueRepOnboardingCompletedState(false);
        setVenueRepPolicyAccepted(false);
        setVenueRepPolicyAcceptedVersion(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markIntroSeen = async () => {
    try {
      if (!user) return;
      const db = getClientDb();
      await updateDoc(doc(db, 'userProfiles', user.uid), { hasSeenVenueRepIntro: true, updatedAt: new Date().toISOString() });
      setHasSeenVenueRepIntroState(true);
    } catch (err) {
      console.error('Failed to update hasSeenVenueRepIntro', err);
    }
  };

  const markOnboardingCompleted = async () => {
    try {
      if (!user) return;
      const db = getClientDb();
      await updateDoc(doc(db, 'userProfiles', user.uid), {
        hasSeenVenueRepIntro: true,
        venueRepOnboardingCompleted: true,
        updatedAt: new Date().toISOString(),
      });
      setHasSeenVenueRepIntroState(true);
      setVenueRepOnboardingCompletedState(true);
    } catch (err) {
      console.error('Failed to update venueRepOnboardingCompleted', err);
    }
  };

  const value = {
    user,
    loading,
    isAdmin,
    isReviewer,
    isVenueRep,
    assignedVenueIds,
    hasSeenVenueRepIntro,
    venueRepOnboardingCompleted,
    venueRepPolicyAccepted,
    venueRepPolicyAcceptedVersion,
    setHasSeenVenueRepIntro: markIntroSeen,
    setVenueRepOnboardingCompleted: markOnboardingCompleted,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
