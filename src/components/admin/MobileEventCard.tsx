'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit, 
  Trash2, 
  MapPin,
  Calendar,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { Event, Venue, EventStatus } from '@/lib/types';
import { updateEventStatusAction, deleteEventAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { toTitleCase } from '@/lib/utils';
import { EventEditorModal } from './EventEditorModal';

type EventWithVenue = Event & { venue?: Venue };

interface MobileEventCardProps {
  event: EventWithVenue;
  venues: Venue[];
}

function formatFirstOccurrence(event: Event): string {
  if (!event.occurrences || event.occurrences.length === 0) {
    return 'No performances';
  }
  const firstOccurrence = event.occurrences[0];
  const firstDate = new Date(`${firstOccurrence.date}T${firstOccurrence.time || '00:00:00'}`);
  
  const datePart = format(firstDate, 'MMM d, yyyy');
  const timePart = firstOccurrence.time ? ` at ${format(firstDate, 'h:mm a')}` : '';

  if (event.occurrences.length > 1) {
    return `Starts ${datePart}${timePart} (${event.occurrences.length} total)`;
  }
  return `${datePart}${timePart}`;
}

function getStatusBadge(status: EventStatus) {
  switch(status) {
    case 'approved': 
      return (
        <Badge variant="secondary" className="border-green-600/40 bg-green-500/10 text-green-700">
          <CheckCircle className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case 'pending': 
      return (
        <Badge variant="secondary" className="border-yellow-600/40 bg-yellow-500/10 text-yellow-700">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    case 'denied': 
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Denied
        </Badge>
      );
    default:
      return null;
  }
}

export function MobileEventCard({ event, venues }: MobileEventCardProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const handleStatusUpdate = (status: 'approved' | 'denied') => {
    startTransition(async () => {
      const result = await updateEventStatusAction(event.id, status);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleDeleteConfirm = () => {
    setIsAlertOpen(false);
    
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleEditClick = () => {
    setEditingEvent(event);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg leading-tight mb-2">
                {toTitleCase(event.title)}
              </h3>
              {getStatusBadge(event.status)}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isPending}>
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Event Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {event.status !== 'approved' && (
                  <DropdownMenuItem onClick={() => handleStatusUpdate('approved')} disabled={isPending}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Approve
                  </DropdownMenuItem>
                )}
                {event.status !== 'denied' && (
                  <DropdownMenuItem onClick={() => handleStatusUpdate('denied')} disabled={isPending}>
                    <XCircle className="mr-2 h-4 w-4" /> Deny
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleEditClick} disabled={isPending}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setIsAlertOpen(true)} 
                  disabled={isPending} 
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
              <span>{event.venue?.name || 'No venue assigned'}</span>
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
              <span>{formatFirstOccurrence(event)}</span>
            </div>

            {event.description && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {event.description}
              </p>
            )}

            {/* Quick Action Buttons for Mobile */}
            <div className="flex gap-2 pt-2">
              {event.status === 'pending' && (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => handleStatusUpdate('approved')}
                    disabled={isPending}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleStatusUpdate('denied')}
                    disabled={isPending}
                    className="flex-1"
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Deny
                  </Button>
                </>
              )}
              {event.status !== 'pending' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleEditClick}
                  disabled={isPending}
                  className="flex-1"
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Edit Event
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event "{toTitleCase(event.title)}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete Event'}
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
