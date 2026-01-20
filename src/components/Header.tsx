
'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export function Header() {
  const { isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-50 py-4 px-4 sm:px-6 lg:px-8 pointer-events-none hidden md:block">
      <div className="container mx-auto flex justify-between items-center pointer-events-auto">
        <div className="relative z-10 text-white drop-shadow-md rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg px-6 py-2">
          <Logo />
        </div>

        <div className="flex items-center gap-6 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg px-6 py-2">
          <nav className="flex items-center space-x-2 text-sm font-medium">
            <Link
              href="/calendar"
              className="px-4 py-2 rounded-full text-white/90 hover:bg-white/10 hover:text-accent transition-all duration-300"
            >
              Calendar
            </Link>
            <Link
              href="/reviews"
              className="px-4 py-2 rounded-full text-white/90 hover:bg-white/10 hover:text-accent transition-all duration-300"
            >
              Reviews
            </Link>
            <Link
              href="/news"
              className="px-4 py-2 rounded-full text-white/90 hover:bg-white/10 hover:text-accent transition-all duration-300"
            >
              News
            </Link>
            <Link
              href="/about-us"
              className="px-4 py-2 rounded-full text-white/90 hover:bg-white/10 hover:text-accent transition-all duration-300"
            >
              About Us
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-full text-white/70 hover:bg-white/10 hover:text-accent transition-all duration-300 hover:opacity-100"
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="h-6 w-px bg-white/20" />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="rounded-full text-white/90 hover:bg-white/10 hover:text-accent transition-colors"
          >
            <Link href="/profile">
              <User className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
