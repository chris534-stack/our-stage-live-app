'use client';

import { useState, useTransition, useEffect } from 'react';
import type { Venue } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createVenueAction, updateVenueAction } from '@/lib/actions';
import { getClientAuth } from '@/lib/firebase';

interface VenueEditorFormProps {
  venue?: Venue;
  onSuccess: () => void;
}

const initialFormData = {
  name: '',
  address: '',
  sourceUrl: '',
  color: '#8D99A6',
};

export function VenueEditorForm({ venue, onSuccess }: VenueEditorFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (venue) {
      setFormData({
        name: venue.name,
        address: venue.address || '',
        sourceUrl: venue.sourceUrl || '',
        color: venue.color || '#8D99A6',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [venue]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      let idToken: string | undefined = undefined;
      try {
        // Force refresh to avoid expired token edge cases
        idToken = (await getClientAuth().currentUser?.getIdToken(true)) || undefined;
      } catch (e) {
        // Non-fatal; server will attempt header-based auth as a fallback
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[VenueEditorForm] Failed to get ID token', e);
        }
      }

      const result = venue
        ? await updateVenueAction(venue.id, formData, idToken)
        : await createVenueAction(formData, idToken);

      if (result.success) {
        toast({ title: venue ? 'Venue Updated' : 'Venue Created', description: result.message });
        onSuccess();
      } else {
        toast({ variant: 'destructive', title: 'Operation Failed', description: result.message });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Venue Name</Label>
        <Input id="name" value={formData.name} onChange={handleFieldChange} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" value={formData.address} onChange={handleFieldChange} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sourceUrl">Source URL (for scraping)</Label>
        <Input id="sourceUrl" type="url" value={formData.sourceUrl} onChange={handleFieldChange} placeholder="https://example.com/events"/>
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Venue Color</Label>
        <div className="flex items-center gap-4">
          <Input id="color" type="color" value={formData.color} onChange={handleFieldChange} className="p-1 h-10 w-16"/>
          <div style={{ backgroundColor: formData.color }} className="h-10 w-full rounded-md border" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
