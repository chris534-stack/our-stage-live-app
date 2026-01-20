
import { getAllVenues } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingRequestForm } from '@/components/about/ListingRequestForm';
import { Sparkles, Target, Eye, Theater, Users, Heart, MapPin } from 'lucide-react';

export default async function AboutUsPage() {
  const venues = await getAllVenues();
  const sortedVenues = [...venues].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/95 via-primary to-primary/85 p-8 md:p-12 text-primary-foreground mb-12">
          {/* Decorative floating elements */}
          <div className="absolute top-4 right-8 opacity-20 animate-subtle-breathe">
            <Users className="h-16 w-16 md:h-24 md:w-24" />
          </div>
          {/* Moved to top-left to avoid bottom text overlap */}
          <div className="absolute top-8 left-8 opacity-15 animate-subtle-breathe delay-500">
            <Heart className="h-12 w-12 md:h-16 md:w-16" />
          </div>

          {/* Blurred accent orbs */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/25 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-accent/20 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              <span>Since 2025</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold font-headline leading-tight">
              About Our Stage,
              <span className="block text-accent">Eugene</span>
            </h1>

            <p className="text-primary-foreground/85 text-lg max-w-2xl mx-auto">
              Connecting performers, directors, crew, and fans to celebrate and support musical theatre in Eugene, Oregon.
            </p>
          </div>
        </div>

        {/* Who We Are - Full Width Card */}
        <Card className="mb-8 shadow-xl bg-gradient-to-br from-card via-card to-card/95 border-border/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl" />
          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Theater className="h-6 w-6 text-accent" />
              </div>
              <CardTitle className="text-2xl font-headline text-primary">Who We Are</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4 relative">
            <p className="text-lg leading-relaxed">
              Our Stage, Eugene is a community-driven platform connecting performers, directors, crew, educators, and fans to celebrate and support musical theatre in Eugene, Oregon. We believe in lowering barriers, amplifying local voices, and making the arts accessible for all.
            </p>
          </CardContent>
        </Card>

        {/* Mission & Vision - Two Column Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="shadow-xl bg-gradient-to-br from-card to-card/95 border-border/50 overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-headline text-primary">Our Mission</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground relative">
              <p className="leading-relaxed">
                Our mission is actively evolving as our community grows. We aim to foster a vibrant, inclusive, and collaborative theatre scene by providing a centralized platform for events, opportunities, and resources.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xl bg-gradient-to-br from-card to-card/95 border-border/50 overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-accent/5 rounded-full blur-xl group-hover:bg-accent/10 transition-colors" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Eye className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-headline text-primary">Our Vision</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground relative">
              <p className="leading-relaxed">
                Our vision is a thriving, connected community where everyone can participate in and enjoy the performing arts. We're always listening and adapting to community needs.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Participating Venues Section */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm font-medium text-primary mb-4">
              <MapPin className="h-4 w-4" />
              <span>Local Partners</span>
            </div>
            <h2 className="text-3xl font-bold font-headline text-primary">Participating Venues</h2>
          </div>

          <Card className="shadow-xl bg-gradient-to-br from-card to-card/95 border-border/50">
            <CardContent className="p-6 md:p-8">
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {sortedVenues.map(venue => (
                  <li key={venue.id} className="flex items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span
                      className="h-4 w-4 rounded-full mr-3 shrink-0 shadow-sm"
                      style={{ backgroundColor: venue.color }}
                    />
                    <span className="text-foreground font-medium">{venue.name}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Listing Request Section */}
        <section>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full text-sm font-medium text-accent mb-4">
              <Sparkles className="h-4 w-4" />
              <span>Join Us</span>
            </div>
            <h2 className="text-3xl font-bold font-headline text-primary">Want to be Listed?</h2>
          </div>

          <Card className="shadow-xl bg-gradient-to-br from-card to-card/95 border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">Request to be Added</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                If you are a theatre company or venue in the Eugene area and would like to be included on our platform, please fill out the form below. We'll get in touch with you soon!
              </p>
              <ListingRequestForm />
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
