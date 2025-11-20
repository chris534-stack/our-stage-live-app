import { getAllEventsWithCreator, getAllVenues } from '@/lib/data';
import AdminDashboard from '@/components/admin/AdminDashboard';
import type { Venue } from '@/lib/types';
import AdminAuthGuard from '@/components/auth/AdminAuthGuard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [allEvents, allVenues] = await Promise.all([
    getAllEventsWithCreator(),
    getAllVenues()
  ]);
  
  const venuesMap = new Map<string, Venue>(allVenues.map(v => [v.id, v]));

  const allEventsWithVenues = allEvents.map(event => ({
    ...event,
    venue: venuesMap.get(event.venueId)
  }));

  return (
    <AdminAuthGuard>
      <AdminDashboard initialEvents={allEventsWithVenues} venues={allVenues} />
    </AdminAuthGuard>
  );
}
