
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { submitReviewAction } from '@/lib/actions';
import type { ExpandedCalendarEvent } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import SignInPromptModal from '@/components/SignInPromptModal';

const experienceOptions = ["Exceptional & Memorable", "Thoroughly Entertaining", "Thought-Provoking & Important", "A Promising Production"];
const categoryOptions = [
    { id: "date-night", label: "Date Night" },
    { id: "family-friendly", label: "Family-Friendly" },
    { id: "comedic", label: "Comedic" },
    { id: "dramatic", label: "Dramatic" },
    { id: "thought-provoking", label: "Thought-Provoking" },
    { id: "musical", label: "Musical" },
];

const reviewFormSchema = z.object({
  overallExperience: z.string().min(1, 'Please select your overall experience.'),
  specialMomentsText: z.string().min(10, 'Please share at least a few words.'),
  recommendations: z.array(z.string()).default([]),
  showHeartText: z.string().min(10, 'Please share at least a few words.'),
  communityImpactText: z.string().min(10, 'Please share at least a few words.'),
  ticketInfo: z.string().min(5, 'Please provide some detail on your ticket.'),
  valueConsiderationText: z.string().min(10, 'Please share at least a few words.'),
  timeWellSpentText: z.string().min(10, 'Please share at least a few words.'),
  disclosureText: z.string().default(''),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface ReviewFormProps {
    event: ExpandedCalendarEvent;
    onSuccess: () => void;
}

export function ReviewForm({ event, onSuccess }: ReviewFormProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { user } = useAuth();
    const [showSignInModal, setShowSignInModal] = useState(false);

    const form = useForm<ReviewFormValues>({
        resolver: zodResolver(reviewFormSchema),
        defaultValues: {
            overallExperience: '',
            specialMomentsText: '',
            recommendations: [],
            showHeartText: '',
            communityImpactText: '',
            ticketInfo: '',
            valueConsiderationText: '',
            timeWellSpentText: '',
            disclosureText: '',
        },
    });

    const onSubmit = (data: ReviewFormValues) => {
        if (!user) {
            setShowSignInModal(true);
            return;
        }

        startTransition(async () => {
            // Fetch Firebase ID token to authenticate and enforce email verification on the server
            let idToken: string | undefined = undefined;
            try {
                idToken = (await user?.getIdToken?.()) || undefined;
            } catch (_) {
                // Non-fatal; server will attempt header-based auth as a fallback
            }

            const result = await submitReviewAction({
                ...data,
                showId: event.id,
                showTitle: event.title,
                performanceDate: event.date,
                reviewerId: user.uid,
                reviewerName: user.displayName || 'Anonymous Reviewer',
            }, idToken);

            if (result.success) {
                toast({
                    title: 'Review Submitted!',
                    description: result.message,
                });
                onSuccess();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Submission Failed',
                    description: result.message,
                });
            }
        });
    };

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 py-4">
                    <Card className="bg-secondary/50 border-accent/20">
                        <CardHeader>
                            <CardTitle className="text-base text-accent">A Note on Community Feedback</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                            Hey there! Our Stage, Eugene, is intended to foster a vibrant and supportive theatre community. Your impartial perspective as an audience member is vital for supporting our local artists and enriching the entire Eugene theatre community. Please offer your insights with encouragement, honesty, and a constructive spirit.
                            </p>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-primary">Section 1: Your Experience</h3>
                        <FormField
                            control={form.control}
                            name="overallExperience"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Overall Experience</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {experienceOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="specialMomentsText"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>What made this performance special?</FormLabel>
                                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                                    <FormDescription>Focus on the strengths. What did you enjoy most? This could be the energy of the ensemble, a standout performance, the set design, lighting, or a particular moment that moved you.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="recommendations"
                            render={() => (
                                <FormItem>
                                    <FormLabel>How would you categorize this show? (Optional)</FormLabel>
                                    {categoryOptions.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="recommendations"
                                            render={({ field }) => (
                                                <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(item.label)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                ? field.onChange([...(field.value || []), item.label])
                                                                : field.onChange(field.value?.filter((value) => value !== item.label))
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">{item.label}</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-primary">Section 2: The Show's Message & Impact</h3>
                        <FormField
                            control={form.control}
                            name="showHeartText"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Describe the Heart of the Show</FormLabel>
                                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                                    <FormDescription>How would you describe the content and tone of the script / source material? Is it a lighthearted spectacle, a joyful celebration, or something more impactful and challenging?</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="communityImpactText"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Is this show important for Eugene right now?</FormLabel>
                                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                                    <FormDescription>Thinking about our local community, does this show feel particularly relevant or necessary? Why or why not?</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-primary">Section 3: Value & Time</h3>
                        <FormField
                            control={form.control}
                            name="ticketInfo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Actual Cost</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormDescription>How much did your ticket cost? What seat did you get for this price?</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="valueConsiderationText"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Production Value & Admission</FormLabel>
                                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                                    <FormDescription>Considering the cost of admission, please discuss the production value. Did the performance, sets, costumes, and overall experience provide a value that felt right for the ticket price?</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="timeWellSpentText"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>A Rewarding Evening?</FormLabel>
                                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                                    <FormDescription>Your time is valuable. Did this production feel like a rewarding way to spend an evening out? What made it feel that way?</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-primary">Section 4: Transparency</h3>
                        <FormField
                            control={form.control}
                            name="disclosureText"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bias & Relationship Disclosure (Optional)</FormLabel>
                                    <FormControl><Textarea rows={3} {...field} placeholder="e.g., I am friends with the lead actor, my partner was the set designer..." /></FormControl>
                                    <FormDescription>It's okay to have friends in theatre—that's the point of community! To maintain integrity, we ask that you're transparent about any relationships that might affect your opinion.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onSuccess}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Review
                        </Button>
                    </div>
                </form>
            </Form>
            <SignInPromptModal
                isOpen={showSignInModal}
                onClose={() => setShowSignInModal(false)}
                title="Sign in to Submit Review"
                description="To submit your review, please sign in or sign up with your Google account."
            />
        </>
    );
}
