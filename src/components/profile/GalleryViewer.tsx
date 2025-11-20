
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import Image from 'next/image';
import { X, ImageUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { setProfilePhotoAction, setCoverPhotoAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

interface GalleryViewerProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    startIndex?: number;
    userName?: string;
    userId: string;
    isOwner: boolean;
}

export function GalleryViewer({ isOpen, onClose, images, startIndex = 0, userName, userId, isOwner }: GalleryViewerProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [api, setApi] = useState<CarouselApi>();
    const [currentImageIndex, setCurrentImageIndex] = useState(startIndex);

    useEffect(() => {
        if (!isOpen) return;
        setCurrentImageIndex(startIndex);
        api?.scrollTo(startIndex, true);
    }, [isOpen, startIndex, api]);
    
    useEffect(() => {
        if (!api) return;
    
        const onSelect = () => {
          setCurrentImageIndex(api.selectedScrollSnap());
        };
    
        api.on("select", onSelect);
    
        return () => {
          api.off("select", onSelect);
        };
    }, [api]);


    if (!images || images.length === 0) {
        return null;
    }
    
    const handleSetPhoto = (action: 'profile' | 'cover') => {
        const imageUrl = images[currentImageIndex];
        startTransition(async () => {
            const result = action === 'profile'
                ? await setProfilePhotoAction(userId, imageUrl)
                : await setCoverPhotoAction(userId, imageUrl);

            if (result.success) {
                toast({ title: 'Success!', description: result.message });
                onClose();
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.message });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-screen-xl w-full h-full max-h-screen p-0 m-0 bg-black/80 border-none flex items-center justify-center">
                <DialogHeader className="sr-only">
                    <DialogTitle>Image Gallery for {userName || 'User'}</DialogTitle>
                    <DialogDescription>
                        A carousel of images from the user's gallery. Use the left and right arrows to navigate or press Esc to close.
                    </DialogDescription>
                </DialogHeader>
                
                {isOwner && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="absolute top-4 left-4 z-50 text-white bg-black/30 hover:bg-black/60 hover:text-white">
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
                                Use As
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleSetPhoto('profile')} disabled={isPending}>
                                Profile Photo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSetPhoto('cover')} disabled={isPending}>
                                Cover Photo
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                
                <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-white bg-black/30 hover:bg-black/60 hover:text-white">
                        <X className="h-6 w-6" />
                        <span className="sr-only">Close</span>
                    </Button>
                </DialogClose>

                <Carousel
                    setApi={setApi}
                    opts={{
                        startIndex: startIndex,
                        loop: true,
                        duration: 20,
                    }}
                    className="w-full max-w-5xl"
                >
                    <CarouselContent>
                        {images.map((url, index) => (
                            <CarouselItem key={index}>
                                <div className="relative w-full h-[80vh]">
                                    <Image
                                        src={url}
                                        alt={`Gallery image ${index + 1}`}
                                        fill
                                        sizes="100vw"
                                        className="object-contain"
                                        data-ai-hint="gallery photo"
                                        unoptimized
                                    />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80" />
                    <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80" />
                </Carousel>
            </DialogContent>
        </Dialog>
    );
}
