
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, MessageSquareQuote, Newspaper, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';

const baseNavItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/reviews', label: 'Reviews', icon: MessageSquareQuote },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/profile', label: 'Profile', icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const navItems = [...baseNavItems];
  if (isAdmin) {
    const adminItem = { href: '/admin', label: 'Admin', icon: Shield };
    const profileIndex = navItems.findIndex(item => item.href === '/profile');
    if (profileIndex !== -1) {
        navItems.splice(profileIndex, 0, adminItem);
    } else {
        navItems.push(adminItem);
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-primary border-t border-border/20 shadow-t-lg z-50">
      <div className="container mx-auto flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center text-center px-2 py-2 rounded-md transition-colors',
                isActive ? 'text-accent' : 'text-primary-foreground/70 hover:text-primary-foreground'
              )}
            >
              <Icon className="h-6 w-6 mb-1" />
              <span className="text-[11px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
