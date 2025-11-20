'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/components/auth/AuthProvider';

type Counts = {
  venueRepInvitationsPending: number;
  reviewerRequestsPending: number;
  listingRequestsNew: number;
  total: number;
};

export function NotificationBell({
  onGoToVenueReps,
  onGoToReviewers,
  onGoToListingRequests,
  refreshIntervalMs = 60000,
}: {
  onGoToVenueReps?: () => void;
  onGoToReviewers?: () => void;
  onGoToListingRequests?: () => void;
  refreshIntervalMs?: number;
}) {
  const { user, isAdmin } = useAuth();
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [open, setOpen] = React.useState(false);

  const fetchCounts = React.useCallback(async () => {
    try {
      if (!user || !isAdmin) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/notification-bell', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCounts(data as Counts);
    } catch (err) {
      console.error('[NotificationBell] failed to load counts:', err);
    }
  }, [user, isAdmin]);

  // initial + interval refresh
  React.useEffect(() => {
    fetchCounts();
    if (!user || !isAdmin) return;
    const id = setInterval(fetchCounts, refreshIntervalMs);
    return () => clearInterval(id);
  }, [user, isAdmin, fetchCounts, refreshIntervalMs]);

  // refetch on popover open
  React.useEffect(() => {
    if (open) fetchCounts();
  }, [open, fetchCounts]);

  const total = counts?.total ?? 0;

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 min-w-[1.25rem] h-5 rounded-full bg-red-600 text-white text-[10px] font-semibold">
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0 overflow-hidden">
        <div className="p-3 border-b">
          <div className="text-sm font-semibold">Admin Notifications</div>
          <div className="text-xs text-muted-foreground">Pending items that may need your attention</div>
        </div>
        <div className="divide-y">
          <Row
            label="Venue Rep Invitations"
            count={counts?.venueRepInvitationsPending ?? 0}
            onClick={onGoToVenueReps}
          />
          <Row
            label="Reviewer Requests"
            count={counts?.reviewerRequestsPending ?? 0}
            onClick={onGoToReviewers}
          />
          <Row
            label="Listing Requests"
            count={counts?.listingRequestsNew ?? 0}
            onClick={onGoToListingRequests}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, count, onClick }: { label: string; count: number; onClick?: () => void }) {
  const clickable = typeof onClick === 'function';
  return (
    <button
      type="button"
      className={`w-full flex items-center justify-between px-3 py-2 text-sm ${
        clickable ? 'hover:bg-muted/60 transition-colors' : ''
      }`}
      onClick={onClick}
      disabled={!clickable}
    >
      <span className="text-left">{label}</span>
      <span className={`ml-3 inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded-full text-xs px-2 ${
        count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {count}
      </span>
    </button>
  );
}
