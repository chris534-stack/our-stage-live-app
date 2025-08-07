import { CommunitySpotlightCard } from './CommunitySpotlight';
import type { CommunitySpotlight } from '@/lib/types';

// Dummy data for testing the Community Spotlight UI
const dummySpotlight: CommunitySpotlight = {
  id: 'dummy-spotlight-1',
  name: 'Sarah Martinez',
  story: `Sarah has been the unsung hero behind the scenes at Eugene's community theatre for over 8 years. As a volunteer stage manager, lighting technician, and set builder, she's contributed to more than 40 productions without ever seeking the spotlight herself.

What makes Sarah truly special is her dedication to mentoring newcomers. She's taught countless volunteers the ropes, from operating sound boards to building flats. Her patient teaching style and infectious enthusiasm have helped dozens of people find their place in the theatre community.

Sarah works a full-time job as a nurse, yet still finds time to volunteer 15-20 hours per week during production seasons. She's often the first to arrive at rehearsals and the last to leave, making sure everything is perfect for the cast and crew.

"Theatre saved my life during a difficult period," Sarah says. "Now I want to make sure everyone who walks through these doors feels the same magic I felt." Her selfless dedication embodies the true spirit of community theatre.`,
  photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face',
  tags: ['Stage Manager', 'Lighting Tech', 'Mentor', 'Volunteer'],
  createdAt: new Date().toISOString(),
  createdBy: 'admin-user',
  isActive: true,
  links: {
    website: 'https://example.com/sarah-portfolio',
    social: 'https://instagram.com/sarahtheatretech'
  },
  adminNotes: 'Featured for her incredible volunteer work and mentorship'
};

export function CommunitySpotlightSectionDebug() {
  return (
    <section className="py-8 md:py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary mb-2">
            Community Spotlight
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Celebrating the amazing people who make theatre possible in Eugene
          </p>
          <div className="mt-2">
            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
              DEBUG MODE - Using dummy data
            </span>
          </div>
        </div>
        
        <div className="flex justify-center">
          <CommunitySpotlightCard spotlight={dummySpotlight} />
        </div>
      </div>
    </section>
  );
}
