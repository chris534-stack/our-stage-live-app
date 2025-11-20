'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { getClientDb } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SignInPromptModal from '@/components/SignInPromptModal';
import { useToast } from '@/hooks/use-toast';

interface SuggestIdeaFormProps {
  closeModal: () => void;
}

export default function SuggestIdeaForm({ closeModal }: SuggestIdeaFormProps) {
  const [formData, setFormData] = useState({
    idea: '',
    showType: '',
    targetAudience: '',
    communityFit: '',
  });

  const [showSignInModal, setShowSignInModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [id]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user) {
      setShowSignInModal(true);
      return;
    }
    try {
      await addDoc(collection(getClientDb(), 'ideas'), {
        ...formData,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        timestamp: new Date(),
      });
      toast({
        title: 'Idea Submitted!',
        description: 'Thank you for your suggestion.',
      });
      setFormData({
        idea: '',
        showType: '',
        targetAudience: '',
        communityFit: '',
      });
      closeModal();
    } catch (error) {
      console.error('Error submitting idea:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'There was a problem submitting your idea. Please try again.',
      });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="idea">What is your idea?</Label>
          <Textarea id="idea" placeholder="Describe your idea here..." value={formData.idea} onChange={handleChange} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="showType">What kind of show is it?</Label>
          <Input id="showType" type="text" placeholder="e.g., Musical, Play, Workshop" value={formData.showType} onChange={handleChange} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="targetAudience">What is the target audience?</Label>
          <Input id="targetAudience" type="text" placeholder="e.g., All ages, Adults, Families" value={formData.targetAudience} onChange={handleChange} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="communityFit">Why do you think this would be a good fit for the community?</Label>
          <Textarea id="communityFit" placeholder="Explain how it aligns with the community's interests..." value={formData.communityFit} onChange={handleChange} required />
        </div>
        <Button type="submit">Submit Idea</Button>
      </form>
      <SignInPromptModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        title="Sign in to Suggest an Idea"
        description="To submit your idea, please sign in or sign up with your Google account."
      />
    </>
  );
}
