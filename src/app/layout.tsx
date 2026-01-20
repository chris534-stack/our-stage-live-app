import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileNav } from '@/components/MobileNav';
import { AuthProvider } from '@/components/auth/AuthProvider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Our Stage, Eugene</title>
        <meta name="description" content="A centralized calendar for theatre events in Eugene." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col bg-background overflow-x-hidden">
            {/* Dynamic Background System */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
              {/* 1. Base Gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />

              {/* 2. Animated Spotlights */}
              <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/10 blur-[100px] animate-spotlight" />
              <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[120px] animate-spotlight animation-delay-2000" />


              {/* 3. Noise Texture Overlay (opacity 3%) */}
              <div
                className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
              />
            </div>

            {/* Header Contrast Gradient - Subtler Vignette */}
            <div className="fixed top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/20 to-transparent z-40 pointer-events-none" />

            <div className="relative z-10 flex flex-col min-h-screen">
              <Header />
              <main className="flex flex-col flex-1">{children}</main>
              <Footer />
            </div>
          </div>
          <MobileNav />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
