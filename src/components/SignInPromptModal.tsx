'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SocialSignInButtons from '@/components/auth/SocialSignInButtons';
import EmailAuthForm from '@/components/auth/EmailAuthForm';


interface SignInPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
}

export default function SignInPromptModal({ isOpen, onClose, title, description }: SignInPromptModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex flex-col items-center justify-center text-center z-[90]">
                <DialogHeader className="space-y-4">
                    <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="w-full max-w-xs space-y-4">
                    <SocialSignInButtons
                        onSignedIn={onClose}
                        onError={(msg) => console.error('Sign-in error (modal):', msg)}
                        fullWidth
                        size="lg"
                        showGoogle
                        showApple={false}
                        showMicrosoft={false}
                        showFacebook={false}
                    />
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden>
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or use your email</span>
                        </div>
                    </div>
                    <EmailAuthForm onSignedIn={onClose} onError={(m) => console.error('Email sign-in error (modal):', m)} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
