'use client';

import React, { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { getClientDb } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

const POLICY_VERSION = 'v1';

function VenueRepPolicyPageComponent() {
  const { user, isVenueRep } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = React.useState(false);
  const [acceptedAt, setAcceptedAt] = React.useState<string | null>(null);
  const [checks, setChecks] = React.useState({
    responsibilities: false,
    assignedOnly: false,
    approvals: false,
    guidelines: false,
  });

  React.useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const db = getClientDb();
        const ref = doc(db, 'userProfiles', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.venueRepPolicyAccepted === true && data.venueRepPolicyAcceptedVersion === POLICY_VERSION) {
            setAlreadyAccepted(true);
            setAcceptedAt(data.venueRepPolicyAcceptedAt || null);
          }
        }
      } catch (e) {
        // non-fatal
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const allChecked = Object.values(checks).every(Boolean);

  const handleAcknowledge = async () => {
    try {
      setSubmitting(true);
      if (!user) return;
      const db = getClientDb();
      const ref = doc(db, 'userProfiles', user.uid);
      const nowIso = new Date().toISOString();
      await updateDoc(ref, {
        venueRepPolicyAccepted: true,
        venueRepPolicyAcceptedVersion: POLICY_VERSION,
        venueRepPolicyAcceptedAt: nowIso,
        updatedAt: nowIso,
      });
      setAlreadyAccepted(true);
      setAcceptedAt(nowIso);
      toast({ title: 'Acknowledged', description: 'Your policy acknowledgement has been saved.' });
      const returnTo = searchParams?.get('returnTo');
      if (returnTo) {
        router.push(returnTo);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save acknowledgement. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Venue Rep Policy</CardTitle>
            <CardDescription>Please sign in to view and acknowledge the policy.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Venue Representative Policy</CardTitle>
          <CardDescription>Version {POLICY_VERSION}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          <div className="space-y-3">
            <p><strong>Your role:</strong> Help keep the community calendar accurate by submitting events for your theatre/venue.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You may add and update events only for venues you are assigned to.</li>
              <li>Submissions are reviewed by an admin before publishing.</li>
              <li>Use clear titles, concise descriptions, and include dates/times.</li>
              <li>Keep information accurate and up to date.</li>
            </ul>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium text-foreground">Permissions</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Add events for your assigned venues</li>
              <li>Edit your own submitted events</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Approvals</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All submissions are reviewed by admins prior to public display</li>
              <li>Admins may make small copy edits for clarity/consistency</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Do / Don’t</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do verify dates, times, and links</li>
              <li>Do keep descriptions concise and informative</li>
              <li>Don’t submit events for venues you don’t represent</li>
              <li>Don’t include sensitive information not intended for the public</li>
            </ul>
          </div>

          <Separator />

          {alreadyAccepted ? (
            <div className="rounded-md border bg-primary/5 text-foreground p-4">
              You acknowledged this policy{acceptedAt ? ` on ${new Date(acceptedAt).toLocaleString()}` : ''}. Thank you.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox id="resp" checked={checks.responsibilities} onCheckedChange={(v) => setChecks((c) => ({ ...c, responsibilities: !!v }))} />
                <Label htmlFor="resp">I understand my responsibilities as a venue representative.</Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="assigned" checked={checks.assignedOnly} onCheckedChange={(v) => setChecks((c) => ({ ...c, assignedOnly: !!v }))} />
                <Label htmlFor="assigned">I will only submit events for venues I’m assigned to.</Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="approvals" checked={checks.approvals} onCheckedChange={(v) => setChecks((c) => ({ ...c, approvals: !!v }))} />
                <Label htmlFor="approvals">I acknowledge all submissions are reviewed by admins before publishing.</Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="guidelines" checked={checks.guidelines} onCheckedChange={(v) => setChecks((c) => ({ ...c, guidelines: !!v }))} />
                <Label htmlFor="guidelines">I will follow community guidelines and keep information accurate.</Label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button asChild variant="ghost">
                  <Link href="/">Back to calendar</Link>
                </Button>
                <Button disabled={!allChecked || loading || submitting || !isVenueRep} onClick={handleAcknowledge}>
                  Acknowledge and continue
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VenueRepPolicyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VenueRepPolicyPageComponent />
    </Suspense>
  );
}
