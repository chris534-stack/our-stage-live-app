
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, CheckCircle, XCircle, Edit, Clock, Trash2 } from 'lucide-react';
import type { Event, Venue, EventStatus } from '@/lib/types';
import { updateEventStatusAction, deleteEventAction } from '@/lib/actions';
import { useTransition, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { toTitleCase, truncateText } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { EventWithCreator } from '@/lib/data';
import { EventEditorModal } from './EventEditorModal';
import { getClientAuth } from '@/lib/firebase';

type EventWithVenue = Event & { venue?: Venue };
type EventWithVenueAndCreator = EventWithVenue & EventWithCreator;

function formatFirstOccurrence(event: Event): string {
    if (!event.occurrences || event.occurrences.length === 0) {
        return 'No performances';
    }
    const firstOccurrence = event.occurrences[0];
    const firstDate = new Date(`${firstOccurrence.date}T${firstOccurrence.time || '00:00:00'}`);
    
    const datePart = format(firstDate, 'MMM d, yyyy');
    const timePart = firstOccurrence.time ? ` at ${format(firstDate, 'h:mm a')}` : '';

    if (event.occurrences.length > 1) {
        return `Starts ${datePart} (${event.occurrences.length} total)`;
    }
    return `${datePart}${timePart}`;
}

export function EventTable({ events, venues }: { events: EventWithVenueAndCreator[], venues: Venue[] }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const handleStatusUpdate = (eventId: string, status: 'approved' | 'denied') => {
    startTransition(async () => {
      let idToken: string | undefined = undefined;
      try {
        idToken = (await getClientAuth().currentUser?.getIdToken()) || undefined;
      } catch (_) {
        // Non-fatal; server will attempt header-based auth as a fallback
      }
      const result = await updateEventStatusAction(eventId, status, idToken);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedEventId) return;
    
    const eventIdToDelete = selectedEventId;
    setIsAlertOpen(false);
    setSelectedEventId(null);
    
    startTransition(async () => {
      let idToken: string | undefined = undefined;
      try {
        idToken = (await getClientAuth().currentUser?.getIdToken()) || undefined;
      } catch (_) {
        // Non-fatal; server will attempt header-based auth as a fallback
      }
      const result = await deleteEventAction(eventIdToDelete, idToken);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  }

  const handleDeleteClick = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsAlertOpen(true);
  }

  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
  };

  const getStatusBadge = (status: EventStatus) => {
    switch(status) {
      case 'approved': 
        return <Badge variant="secondary" className="border-green-600/40 bg-green-500/10 text-green-700">
          <CheckCircle className="mr-1 h-3 w-3" />Approved
        </Badge>;
      case 'pending': 
        return <Badge variant="secondary" className="border-yellow-600/40 bg-yellow-500/10 text-yellow-700">
          <Clock className="mr-1 h-3 w-3" />Pending
        </Badge>;
      case 'denied': 
        return <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />Denied
        </Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Performances</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length > 0 ? events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{toTitleCase(event.title)}</TableCell>
                  <TableCell>{event.venue?.name || 'N/A'}</TableCell>
                  <TableCell>{formatFirstOccurrence(event)}</TableCell>
                  <TableCell>{getStatusBadge(event.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              {truncateText(event.createdByName || event.createdByEmail || 'Unknown', 20)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{event.createdByName || event.createdByEmail || 'Unknown'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {event.createdByIsVenueRep && (
                        <Badge variant="outline">Rep</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Event Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator/>
                        {event.status !== 'approved' && (
                          <DropdownMenuItem onClick={() => handleStatusUpdate(event.id, 'approved')} disabled={isPending}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Approve
                          </DropdownMenuItem>
                        )}
                        {event.status !== 'denied' && (
                          <DropdownMenuItem onClick={() => handleStatusUpdate(event.id, 'denied')} disabled={isPending}>
                            <XCircle className="mr-2 h-4 w-4" /> Deny
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEditClick(event)} disabled={isPending}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteClick(event.id)} disabled={isPending} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No events found in this category.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEventId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending}>
                {isPending ? 'Deleting...' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EventEditorModal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        eventToEdit={editingEvent}
        venues={venues}
      />
    </>
  );
}
