'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/types';
import { PlaybillCard } from './PlaybillCard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSwipeable } from 'react-swipeable';
import { useAuth } from '@/components/auth/AuthProvider';
import SignInPromptModal from '@/components/SignInPromptModal';

interface CommunityDirectoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommunityDirectory({ isOpen, onClose }: CommunityDirectoryProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    if (isOpen && profiles.length === 0) {
      fetchProfiles();
    }
  }, [isOpen]);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/community');
      if (!response.ok) throw new Error('Failed to fetch profiles');
      
      const data = await response.json();
      setProfiles(data);
    } catch (error) {
      console.error('Error fetching community profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load community directory. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const nextProfile = () => {
    setCurrentIndex((prev) => (prev + 1) % profiles.length);
  };

  const prevProfile = () => {
    setCurrentIndex((prev) => (prev - 1 + profiles.length) % profiles.length);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;
    
    if (e.key === 'ArrowRight') nextProfile();
    if (e.key === 'ArrowLeft') prevProfile();
    if (e.key === 'Escape') onClose();
  };

  // Swipe gesture handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (profiles.length > 1) nextProfile();
    },
    onSwipedRight: () => {
      if (profiles.length > 1) prevProfile();
    },
    trackMouse: false, // Only track touch events on mobile
    preventScrollOnSwipe: true,
    trackTouch: true,
  });

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextProfile, prevProfile, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 text-white">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <h2 className="text-2xl font-bold font-headline">Community Directory</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center">
          {isLoading ? (
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading community directory...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-white text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl mb-2">No community members found</p>
              <p className="text-sm opacity-75">Check back later as our community grows!</p>
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-full">
              {/* Navigation Buttons */}
              {profiles.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevProfile}
                    className="absolute left-4 z-10 text-white hover:bg-white/20 w-12 h-12"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextProfile}
                    className="absolute right-4 z-10 text-white hover:bg-white/20 w-12 h-12"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* Playbill Stack */}
              <div className="relative flex items-center justify-center" {...swipeHandlers}>
                <div className="relative" style={{ width: '288px', height: '500px' }}>
                  {profiles.map((profile, index) => {
                    const offset = index - currentIndex;
                    const isVisible = Math.abs(offset) <= 2;
                    
                    if (!isVisible) return null;

                    return (
                      <div
                        key={profile.userId}
                        className="absolute top-0 left-0 transition-all duration-500 ease-out"
                        style={{
                          transform: `
                            translateX(${offset * 20}px) 
                            translateY(${Math.abs(offset) * 10}px) 
                            scale(${1 - Math.abs(offset) * 0.1})
                            rotateY(${offset * 5}deg)
                          `,
                          zIndex: 10 - Math.abs(offset),
                          opacity: offset === 0 ? 1 : 0.7 - Math.abs(offset) * 0.2,
                        }}
                      >
                        <PlaybillCard 
                          profile={profile} 
                          onClick={offset === 0 ? onClose : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Instructions */}
        {profiles.length > 0 && (
          <div className="text-center text-white/75 text-sm mt-3">
            <p className="hidden sm:block">Use arrow keys or click the arrows to browse • Click a playbill to view their full story</p>
            <p className="block sm:hidden">Swipe left or right to browse • Tap a playbill to view their full story</p>
          </div>
        )}

        {/* Signed-out CTA to create profile */}
        {!user && (
          <div className="mt-2 flex flex-col items-center">
            <Button
              onClick={() => setShowSignIn(true)}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-6 rounded-full shadow-lg"
              size="lg"
            >
              Create your profile
            </Button>
            <SignInPromptModal
              isOpen={showSignIn}
              onClose={() => setShowSignIn(false)}
              title="Sign in to get started"
              description="Join the community and share your story."
            />
          </div>
        )}
      </div>
    </div>
  );
}

