'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Users, BookOpen } from 'lucide-react';
import { CommunityDirectory } from './CommunityDirectory';
import Image from 'next/image';
import { getOptimizedProfilePhoto } from '@/lib/image-utils';

// Inline avatar group preview for the Community Directory tile
function UserAvatarGroupPreview() {
  const [avatars, setAvatars] = useState<Array<{ id: string; name: string; photoURL?: string }>>([]);
  const [totalCount, setTotalCount] = useState(0);

  const allowedHosts = new Set([
    'lh3.googleusercontent.com',
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
    'res.cloudinary.com',
    'placehold.co',
  ]);
  const isRenderableHost = (url?: string) => {
    if (!url) return false;
    try {
      const u = new URL(url);
      if (u.hostname === 'example.com') return false;
      return allowedHosts.has(u.hostname);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const res = await fetch('/api/community');
        if (!res.ok) throw new Error('Failed to load community');
        const profiles: Array<{ userId: string; displayName: string; photoURL?: string }> = await res.json();
        if (!isMounted) return;
        const list = Array.isArray(profiles) ? profiles : [];

        setTotalCount(list.length);

        // Prefer valid, renderable photo hosts; fall back later to default avatar
        const withValidPhotos = list.filter(p => isRenderableHost(p.photoURL));
        const topFive = (withValidPhotos.length > 0 ? withValidPhotos : list)
          .slice(0, 5)
          .map(p => ({ id: p.userId, name: p.displayName, photoURL: p.photoURL }));

        setAvatars(topFive);
      } catch {
        // Silent fail for preview; keep UI clean
      }
    })();

    return () => { isMounted = false; };
  }, []);

  const displayedCount = avatars.length;

  return (
    <div className="flex justify-center items-center gap-2 mb-3">
      <div className="flex -space-x-2">
        {avatars.map((p) => (
          <div key={p.id} className="border-2 border-white rounded-full h-9 w-9 overflow-hidden bg-gray-200">
            <Image
              src={getOptimizedProfilePhoto(isRenderableHost(p.photoURL) ? p.photoURL : undefined, 'avatar')}
              alt={p.name}
              width={36}
              height={36}
              className="object-cover h-9 w-9"
            />
          </div>
        ))}
        {totalCount > displayedCount && (
          <span className="flex items-center justify-center bg-white text-xs text-gray-800 font-semibold border-2 border-gray-200 rounded-full h-9 w-9">
            +{totalCount - displayedCount}
          </span>
        )}
      </div>
    </div>
  );
}

export function CommunityExplorationSection() {
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);

  return (
    <>
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-yellow-500/15 ring-1 ring-yellow-500/30">
                  <BookOpen className="w-5 h-5 text-yellow-700" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold font-headline text-gray-900">
                  Our Theatre Community
                </h2>
              </div>
              
              <p className="text-base md:text-lg text-gray-800 leading-relaxed max-w-2xl mx-auto">
                Discover the stories, memories, and journeys of fellow theatre lovers in Eugene. 
                Each member brings their own unique perspective to our vibrant community.
              </p>
            </div>

            {/* Centered Playbill Preview */}
            <div className="relative flex justify-center">
              {/* soft glow behind card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 md:h-[22rem] md:w-[22rem] rounded-full bg-yellow-400/30 blur-[90px]"
              />
              <div
                className="relative z-10 group cursor-pointer max-w-sm md:max-w-md"
                role="button"
                tabIndex={0}
                aria-label="Open Community Directory"
                onClick={() => setIsDirectoryOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDirectoryOpen(true); } }}
              >
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
                  {/* Authentic Playbill Header */}
                  <div className="relative h-14 md:h-16 border-b border-gray-100">
                    <Image
                      src="/playbill-header.png"
                      alt="Playbill header"
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-contain w-full h-full"
                      priority
                    />
                  </div>
                  
                  {/* Preview Content */}
                  <div className="p-5 md:p-6">
                    <div className="text-center mb-3">
                      <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-1 tracking-wide">
                        Community Directory
                      </h3>
                      <div className="flex items-center justify-center mb-2">
                        <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
                          Theatre lovers
                        </span>
                      </div>
                    </div>
                    
                    {/* Live Member Avatars (preview) */}
                    <UserAvatarGroupPreview />
                    
                    {/* Call to Action */}
                    <div className="pt-4 border-t border-gray-100">
                      <Button size="lg" className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-md">
                        <Users className="w-4 h-4" aria-hidden="true" />
                        <span>Explore stories</span>
                      </Button>
                    </div>
                  </div>
                </div>
                
                
              </div>
            </div>
          </div>
        </div>
      </section>

      <CommunityDirectory 
        isOpen={isDirectoryOpen} 
        onClose={() => setIsDirectoryOpen(false)} 
      />
    </>
  );
}
