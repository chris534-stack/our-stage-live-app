'use client';

import { UserProfile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getOptimizedProfilePhoto } from '@/lib/image-utils';
import Link from 'next/link';
import Image from 'next/image';

interface PlaybillCardProps {
  profile: UserProfile;
  onClick?: () => void;
}

export function PlaybillCard({ profile, onClick }: PlaybillCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateYearsInCommunity = (startDate?: string): string => {
    if (!startDate) return 'New to the community';
    
    const start = new Date(startDate);
    const now = new Date();
    const years = now.getFullYear() - start.getFullYear();
    
    if (years === 0) return 'New this year';
    if (years === 1) return '1 year in community';
    return `${years} years in community`;
  };

  return (
    <Link href={`/profile/${profile.userId}`} onClick={onClick}>
      <Card className="w-72 h-[500px] bg-white border border-gray-300 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105 overflow-hidden flex flex-col">
        {/* Authentic Playbill Header Image */}
        <div className="w-full flex-shrink-0">
          <Image
            src="/playbill-header.png"
            alt="Playbill header"
            width={288}
            height={68}
            priority
            className="w-full h-auto"
          />
        </div>

        {/* Large Profile Photo Section - Prominent like before */}
        <div className="flex-1 bg-gray-100 relative">
          <Image
            src={getOptimizedProfilePhoto(profile.photoURL, 'playbill')}
            alt={`${profile.displayName}'s photo`}
            fill
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-500 group-hover:scale-110"
          />
        </div>

        {/* White Information Section - Like Real Playbills */}
        <div className="bg-white p-4 flex-shrink-0">
          {/* Name - Playbill style */}
          <h3 className="text-xl font-black text-black mb-2 text-center leading-tight font-serif tracking-wide">
            {profile.displayName}
          </h3>

          {/* Role */}
          {profile.roleInCommunity && (
            <div className="text-center mb-2">
              <span className="text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded border">
                {profile.roleInCommunity}
              </span>
            </div>
          )}

          {/* Community Duration */}
          <div className="text-xs text-gray-600 mb-2 text-center font-medium">
            {calculateYearsInCommunity(profile.communityStartDate)}
          </div>

          {/* Bio - Program Notes Style */}
          {profile.bio && (
            <div className="mb-2">
              <p className="text-xs text-gray-700 leading-relaxed italic text-center">
                {profile.bio.length > 80 ? profile.bio.substring(0, 80) + '...' : profile.bio}
              </p>
            </div>
          )}

          {/* Bottom Section */}
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 font-medium text-center italic">
              Tap to read their story
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
