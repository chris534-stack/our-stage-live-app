'use client';

import { useState } from 'react';
import type { Venue } from '@/lib/types';
import { VenueCard } from './VenueCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VenueEditorForm } from './VenueEditorForm';
import { Plus } from 'lucide-react';

export function VenueManager({ venues }: { venues: Venue[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  // Sort venues alphabetically by name
  const sortedVenues = [...venues].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Venue
        </Button>
      </div>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Venue</DialogTitle>
          </DialogHeader>
          <VenueEditorForm onSuccess={() => setIsAddOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
      {sortedVenues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} />
      ))}
      </div>
    </div>
  );
}
