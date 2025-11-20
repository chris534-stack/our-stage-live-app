"use client";

import { useTransition, useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Review } from "@/lib/types";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateReviewAction } from "@/lib/actions";
import { Loader2 } from "lucide-react";

const experienceOptions = [
  "Exceptional & Memorable",
  "Thoroughly Entertaining",
  "Thought-Provoking & Important",
  "A Promising Production",
];

const categoryOptions = [
  { id: "date-night", label: "Date Night" },
  { id: "family-friendly", label: "Family-Friendly" },
  { id: "comedic", label: "Comedic" },
  { id: "dramatic", label: "Dramatic" },
  { id: "thought-provoking", label: "Thought-Provoking" },
  { id: "musical", label: "Musical" },
];

const editSchema = z.object({
  overallExperience: z.string().min(1, "Please select your overall experience."),
  specialMomentsText: z.string().min(10, "Please share at least a few words."),
  recommendations: z.array(z.string()).optional(),
  showHeartText: z.string().min(10, "Please share at least a few words."),
  communityImpactText: z.string().min(10, "Please share at least a few words."),
  ticketInfo: z.string().min(5, "Please provide some detail on your ticket."),
  valueConsiderationText: z.string().min(10, "Please share at least a few words."),
  timeWellSpentText: z.string().min(10, "Please share at least a few words."),
  disclosureText: z.string().optional(),
});

type EditValues = z.infer<typeof editSchema>;

export function EditReviewForm({ review, onSuccess }: { review: Review; onSuccess: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<string[]>(review.recommendations || []);
  const { user } = useAuth();

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      overallExperience: review.overallExperience || "",
      specialMomentsText: review.specialMomentsText || "",
      recommendations: review.recommendations || [],
      showHeartText: review.showHeartText || "",
      communityImpactText: review.communityImpactText || "",
      ticketInfo: review.ticketInfo || "",
      valueConsiderationText: review.valueConsiderationText || "",
      timeWellSpentText: review.timeWellSpentText || "",
      disclosureText: review.disclosureText || "",
    },
  });

  const onSubmit = (data: EditValues) => {
    startTransition(async () => {
      // Fetch Firebase ID token so the server action can authenticate the requester
      let idToken: string | undefined = undefined;
      try {
        idToken = (await user?.getIdToken?.()) || undefined;
      } catch (e) {
        // Non-fatal: server action will still attempt header-based auth, but this improves success rate on client calls
      }

      const result = await updateReviewAction(
        review.id,
        {
          ...data,
          recommendations: categories,
        },
        idToken
      );
      if (result.success) {
        toast({ title: "Review Updated", description: result.message });
        onSuccess();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Overall Experience */}
        <FormField
          control={form.control}
          name="overallExperience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Overall Experience</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your overall experience" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {experienceOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recommendations */}
        <div className="space-y-2">
          <FormLabel>Recommendations</FormLabel>
          <div className="grid grid-cols-2 gap-2">
            {categoryOptions.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={categories.includes(cat.id)}
                  onCheckedChange={(v) => {
                    setCategories((prev) =>
                      v ? Array.from(new Set([...prev, cat.id])) : prev.filter((c) => c !== cat.id)
                    );
                  }}
                />
                {cat.label}
              </label>
            ))}
          </div>
        </div>

        {/* Text sections */}
        <FormField
          control={form.control}
          name="specialMomentsText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What made this performance special?</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="showHeartText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>The Heart of the Show</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
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
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ticketInfo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ticket & Seat Info</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
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
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
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
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="disclosureText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transparency Disclosure (Optional)</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormDescription>
                Be transparent about any relationships that might affect your opinion.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
