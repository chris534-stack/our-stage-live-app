
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, MessageSquareQuote, Newspaper, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)]">
      {/* Floating glassmorphic pill container */}
      <div
        className={cn(
          "pointer-events-auto mx-4 mb-3",
          "flex justify-around items-center",
          "py-2 px-1",
          // Glassmorphic styling - high saturation and deeper color
          "bg-primary/80 backdrop-blur-lg backdrop-saturate-[180%]",
          "border border-white/20",
          "shadow-lg shadow-primary/40",
          // Squircle / super-ellipse rounded corners
          "rounded-[28px]"
        )}
        style={{
          // Add subtle noise texture for frosted glass effect
          backgroundImage: `
            linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%),
            linear-gradient(225deg, rgba(255,255,255,0.05) 0%, transparent 30%)
          `
        }}
      >
        <AnimatePresence>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center text-center px-3 py-1.5 rounded-2xl transition-colors duration-200 z-10',
                  isActive
                    ? 'text-accent'
                    : 'text-primary-foreground/80 hover:text-primary-foreground'
                )}
              >
                {/* Liquid Morph Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavTab"
                    className="absolute inset-0 bg-white/15 rounded-2xl -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                      mass: 0.8
                    }}
                  />
                )}

                <Icon className={cn(
                  "h-5 w-5 mb-0.5 transition-transform duration-200",
                  isActive && "scale-110"
                )} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </AnimatePresence>
      </div>
    </nav>
  );
}
