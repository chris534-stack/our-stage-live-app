import { TheatreLivingTimeline } from '@/components/TheatreLivingTimeline';
import { getAllEvents, getAllVenues } from '@/lib/data';

export default async function TimelineDemoPage() {
    const events = await getAllEvents({ includeOccurrences: true });
    const venues = await getAllVenues();

    return (
        <div className="w-full min-h-screen bg-background text-foreground flex flex-col">
            <header className="p-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto w-full">
                    <h1 className="text-2xl font-bold text-primary">
                        Theatre Archive Timeline
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        A living history of productions across our partner venues.
                    </p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
                <section className="w-full">
                    <TheatreLivingTimeline events={events} venues={venues} />
                </section>
            </main>
        </div>
    );
}
