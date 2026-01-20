'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FileText,
  MapPin,
  Globe,
  Users,
  UserCheck,
  Star,
  BarChart3,
  Menu,
  X,
  Bug,
  UserCog,
  Library
} from 'lucide-react';
import { NotificationBell } from '@/components/admin/NotificationBell';

export type AdminSection =
  | 'events'
  | 'venues'
  | 'scraper'
  | 'archive'
  | 'users'
  | 'reviewers'
  | 'spotlights'
  | 'analytics'
  | 'venueReps'
  | 'debug';

interface AdminNavItem {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  mobileLabel: string;
}

const navItems: AdminNavItem[] = [
  { id: 'events', label: 'Event Reviews', icon: FileText, mobileLabel: 'Events' },
  { id: 'venues', label: 'Venues', icon: MapPin, mobileLabel: 'Venues' },
  { id: 'scraper', label: 'Web Scraper', icon: Globe, mobileLabel: 'Scraper' },
  { id: 'archive', label: 'Archive Research', icon: Library, mobileLabel: 'Archive' },
  { id: 'users', label: 'Users Directory', icon: Users, mobileLabel: 'Users' },
  { id: 'reviewers', label: 'Reviewer Hub', icon: UserCheck, mobileLabel: 'Reviewers' },
  { id: 'spotlights', label: 'Community Spotlights', icon: Star, mobileLabel: 'Spotlights' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, mobileLabel: 'Analytics' },
  { id: 'venueReps', label: 'Venue Representatives', icon: UserCog, mobileLabel: 'Venue Reps' },
  { id: 'debug', label: 'Debug Tools', icon: Bug, mobileLabel: 'Debug' },
];

interface ResponsiveAdminLayoutProps {
  children: React.ReactNode;
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

export function ResponsiveAdminLayout({
  children,
  activeSection,
  onSectionChange
}: ResponsiveAdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r border-gray-200">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold font-headline text-primary">Admin Dashboard</h1>
          </div>
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-colors',
                      activeSection === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <h1 className="text-lg font-bold font-headline text-primary">Admin</h1>
          <div className="flex items-center gap-1">
            <NotificationBell
              onGoToVenueReps={() => onSectionChange('venueReps')}
              onGoToReviewers={() => onSectionChange('reviewers')}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Navigation</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="p-2 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSectionChange(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left transition-colors',
                        activeSection === item.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="md:pl-64">
        <div className="flex flex-col">
          {/* Desktop Top Bar */}
          <div className="hidden md:flex items-center justify-end bg-white border-b border-gray-200 px-4 py-3">
            <NotificationBell
              onGoToVenueReps={() => onSectionChange('venueReps')}
              onGoToReviewers={() => onSectionChange('reviewers')}
            />
          </div>
          {/* Content Area */}
          <main className="flex-1">
            <div className="p-4 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  'flex flex-col items-center py-2 px-1 text-xs font-medium transition-colors min-w-0 flex-1',
                  activeSection === item.id
                    ? 'text-primary'
                    : 'text-gray-600'
                )}
              >
                <Icon className="h-5 w-5 mb-1 flex-shrink-0" />
                <span className="truncate">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Padding */}
      <div className="md:hidden h-16" />
    </div>
  );
}
