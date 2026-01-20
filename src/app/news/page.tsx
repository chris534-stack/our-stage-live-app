
import { AddArticleButton } from '@/components/news/AddArticleButton';
import { getAllNewsArticles } from '@/lib/data';
import { NewsList } from '@/components/news/NewsList';
import { Newspaper, Sparkles, MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewsPage() {
    const articles = await getAllNewsArticles();

    return (
        <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/95 via-primary to-primary/85 p-6 md:p-8 text-primary-foreground mb-8 max-w-6xl mx-auto">
                {/* Decorative floating elements */}
                <div className="absolute top-3 right-6 opacity-20 animate-subtle-breathe">
                    <Newspaper className="h-12 w-12 md:h-16 md:w-16" />
                </div>
                {/* Moved from bottom-left to top-center/right area */}
                <div className="absolute top-8 right-1/4 opacity-10 animate-subtle-breathe delay-500">
                    <MessageSquare className="h-16 w-16 md:h-20 md:w-20" />
                </div>

                {/* Blurred accent orbs */}
                <div className="absolute -top-8 -left-8 w-32 h-32 bg-accent/25 rounded-full blur-3xl" />
                <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-accent/20 rounded-full blur-3xl" />

                {/* Content */}
                <div className="relative z-10 space-y-3">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium">
                        <Sparkles className="h-3 w-3" />
                        <span>Stay Informed</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold font-headline">
                        News & Reviews
                    </h1>
                    <p className="text-primary-foreground/80 text-sm md:text-base max-w-xl">
                        The latest news and reviews from the Eugene theatre scene.
                    </p>
                </div>
            </div>

            {/* News List */}
            <div className="max-w-6xl mx-auto">
                <NewsList initialArticles={articles} />
            </div>

            <AddArticleButton />
        </div>
    );
}
