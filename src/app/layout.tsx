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
            <div className="relative flex min-h-screen flex-col bg-background">
              <Header />
              <main className="flex flex-col flex-1">{children}</main>
              <Footer />
            </div>
            <MobileNav />
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
