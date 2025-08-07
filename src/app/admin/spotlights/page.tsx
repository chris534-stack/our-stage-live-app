import { getAllSpotlights } from '@/lib/data';
import { SpotlightManager } from '@/components/admin/SpotlightManager';

export default async function SpotlightAdminPage() {
  // TODO: Add proper admin authentication check when auth system is implemented

  const spotlights = await getAllSpotlights();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Community Spotlights</h1>
          <p className="text-muted-foreground">
            Manage community member spotlights to recognize the amazing people who make theatre possible.
          </p>
        </div>
        
        <SpotlightManager initialSpotlights={spotlights} />
      </div>
    </div>
  );
}
