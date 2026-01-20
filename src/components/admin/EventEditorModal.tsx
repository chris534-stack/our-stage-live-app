
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EventEditorForm } from '@/components/admin/EventEditorForm';
import type { Event, Venue } from '@/lib/types';

import { useRouter } from 'next/navigation';

interface EventEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventToEdit: Event | null;
    venues: Venue[];
}

export function EventEditorModal({ isOpen, onClose, eventToEdit, venues }: EventEditorModalProps) {
    const router = useRouter();

    if (!eventToEdit) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>
                        Update the event details below. Changes will be reflected on the calendar immediately.
                    </DialogDescription>
                </DialogHeader>
                <EventEditorForm
                    eventToEdit={eventToEdit}
                    venues={venues}
                    onSuccess={() => {
                        router.refresh();
                        onClose();
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
