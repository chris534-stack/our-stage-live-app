
'use client';

import { useState, useTransition } from 'react';
import type { Venue } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteVenueAction } from '@/lib/actions';
import { Edit, Trash2 } from 'lucide-react';
import { VenueEditorForm } from './VenueEditorForm';
import { getClientAuth } from '@/lib/firebase';

export function VenueCard({ venue }: { venue: Venue }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      let idToken: string | undefined = undefined;
      try {
        idToken = (await getClientAuth().currentUser?.getIdToken()) || undefined;
      } catch (_) {
        // Non-fatal; server will attempt header-based auth as a fallback
      }
      const result = await deleteVenueAction(venue.id, idToken);
      if (result.success) {
        toast({ title: 'Venue Deleted', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: result.message });
      }
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <span style={{ backgroundColor: venue.color }} className="h-4 w-4 rounded-full" />
          {venue.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground break-all">
          {venue.sourceUrl ? (
            <a href={venue.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {venue.sourceUrl}
            </a>
          ) : (
            'No source URL'
          )}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {venue.name}</DialogTitle>
            </DialogHeader>
            <VenueEditorForm venue={venue} onSuccess={() => setIsEditOpen(false)} />
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the venue "{venue.name}". This will not delete associated events, but they will no longer be linked to this venue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                {isPending ? 'Deleting...' : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
