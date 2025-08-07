'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, Sparkles } from 'lucide-react';
import { CommunityDirectory } from './CommunityDirectory';
import Image from 'next/image';

export function CommunityExplorationSection() {
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);

  return (
    <>
      <section className="py-12 md:py-16 bg-gradient-to-br from-yellow-100 via-yellow-50 to-amber-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold font-headline text-black">
                  Our Theatre Community
                </h2>
              </div>
              
              <p className="text-lg text-black leading-relaxed max-w-2xl mx-auto">
                Discover the stories, memories, and journeys of fellow theatre lovers in Eugene. 
                Each member brings their own unique perspective to our vibrant community.
              </p>
            </div>

            {/* Centered Playbill Preview */}
            <div className="flex justify-center">
              <div className="relative group cursor-pointer max-w-md" onClick={() => setIsDirectoryOpen(true)}>
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  {/* Authentic Playbill Header */}
                  <div className="relative">
                    <Image
                      src="/playbill-header.png"
                      alt="Playbill header"
                      width={400}
                      height={75}
                      className="w-full h-auto"
                      priority
                    />
                  </div>
                  
                  {/* Preview Content */}
                  <div className="p-6">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-black text-black mb-2 font-serif tracking-wide">
                        COMMUNITY DIRECTORY
                      </h3>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded border">
                          Theatre Lovers
                        </span>
                      </div>
                    </div>
                    
                    {/* Sample Member Avatars */}
                    <div className="flex justify-center items-center gap-2 mb-4">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-xs font-black text-black">
                          ZA
                        </div>
                        <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center text-xs font-black text-black">
                          CR
                        </div>
                        <div className="w-8 h-8 rounded-full bg-yellow-300 border-2 border-black flex items-center justify-center text-xs font-black text-black">
                          +4
                        </div>
                      </div>
                      <Users className="w-4 h-4 text-amber-600" />
                    </div>
                    
                    <p className="text-xs text-gray-700 leading-relaxed italic text-center mb-4">
                      "Stories, memories, and journeys of fellow theatre lovers..."
                    </p>
                    
                    {/* Call to Action */}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-black px-4 py-2 rounded-lg shadow-md transition-all duration-200 group-hover:shadow-lg">
                          <Users className="w-4 h-4" />
                          <span className="text-sm">Tap to explore stories</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-600 italic font-medium">
                    "Like collecting programs from every show you've ever seen"
                  </p>
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
