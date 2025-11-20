'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserMinus, Edit, UserCog, Loader2, RotateCcw } from 'lucide-react';
import type { UserProfile, Venue } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface ActiveVenueRepsProps {
  venues: Venue[];
}

export function ActiveVenueReps({ venues }: ActiveVenueRepsProps) {
  const [reps, setReps] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedRep, setSelectedRep] = useState<UserProfile | null>(null);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const venuesById = useMemo(() => {
    const map: Record<string, Venue> = {};
    for (const v of venues) map[v.id] = v;
    return map;
  }, [venues]);

  useEffect(() => {
    fetchReps();
  }, []);

  const fetchReps = async () => {
    try {
      setLoading(true);
      const resp = await fetch('/api/admin/venue-reps');
      if (!resp.ok) throw new Error('Failed to fetch venue reps');
      const data: UserProfile[] = await resp.json();
      setReps(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load venue reps');
    } finally {
      setLoading(false);
    }
  };

  const filteredReps = reps.filter((u) =>
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openManageDialog = (rep: UserProfile) => {
    setSelectedRep(rep);
    setSelectedVenueIds(rep.assignedVenueIds || []);
    setManageDialogOpen(true);
  };

  const toggleVenueSelection = (venueId: string, checked: boolean) => {
    setSelectedVenueIds((prev) => (checked ? [...prev, venueId] : prev.filter((id) => id !== venueId)));
  };

  const saveAssignments = async () => {
    if (!selectedRep) return;
    try {
      setSavingAssignments(true);
      const resp = await fetch(`/api/admin/venue-reps/${selectedRep.userId}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedVenueIds: selectedVenueIds }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to update assignments');
      toast({ title: 'Updated', description: 'Assigned venues updated successfully.' });
      setManageDialogOpen(false);
      setSelectedRep(null);
      await fetchReps();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update assignments', variant: 'destructive' });
    } finally {
      setSavingAssignments(false);
    }
  };

  const disableVenueRep = async (rep: UserProfile) => {
    if (!confirm(`Disable venue rep status for ${rep.displayName}? This will remove all venue assignments.`)) return;
    try {
      const resp = await fetch(`/api/admin/venue-reps/${rep.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVenueRep: false }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to update user');
      toast({ title: 'Disabled', description: 'Venue representative access removed.' });
      await fetchReps();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to disable venue rep', variant: 'destructive' });
    }
  };

  const resetOnboarding = async (rep: UserProfile) => {
    if (!confirm(`Reset onboarding flags for ${rep.displayName}?`)) return;
    try {
      const resp = await fetch(`/api/admin/venue-reps/${rep.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasSeenVenueRepIntro: false, venueRepOnboardingCompleted: false }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to reset onboarding');
      toast({ title: 'Onboarding reset', description: 'Onboarding flags reset.' });
      await fetchReps();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to reset onboarding', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-headline mb-2">Active Venue Representatives</h2>
        <p className="text-muted-foreground">View and manage active venue reps, their venue access, and onboarding state</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search venue reps..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* List */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h3 className="text-lg font-medium">Active Reps ({filteredReps.length})</h3>
          <Button 
            onClick={() => router.push('/admin?section=venueReps&invite=1')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto shrink-0"
          >
            <UserCog className="mr-2 h-4 w-4" />
            Invite Venue Rep
          </Button>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading venue reps...
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">{error}</div>
          ) : filteredReps.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No active venue representatives found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredReps.map((u) => (
                <Card key={u.userId} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Left section - Avatar and basic info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={u.photoURL} alt={u.displayName} />
                          <AvatarFallback className="text-sm">
                            {u.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-medium text-base truncate">{u.displayName}</h3>
                            <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200">
                              Venue Rep
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className={`text-[10px] h-5 ${u.venueRepOnboardingCompleted 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                            >
                              {u.venueRepOnboardingCompleted ? 'Onboarded' : 'Onboarding'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>

                      {/* Right section - Venue assignments */}
                      <div className="sm:ml-auto md:max-w-[55%] w-full">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-xs font-medium text-muted-foreground">Assigned Venues</h4>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                            {(u.assignedVenueIds || []).length}
                          </Badge>
                        </div>
                        <div className="flex gap-1.5 whitespace-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible pr-1">
                          {(u.assignedVenueIds || []).length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">No venues assigned</span>
                          ) : (
                            (u.assignedVenueIds || []).slice(0, 3).map((id) => (
                              <Badge 
                                key={id} 
                                variant="outline" 
                                className="text-xs px-2 py-0.5 font-normal bg-muted/30"
                              >
                                {venuesById[id]?.name || id}
                              </Badge>
                            ))
                          )}
                          {(u.assignedVenueIds || []).length > 3 && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-muted/20">
                              +{(u.assignedVenueIds || []).length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 pt-3 border-t flex flex-wrap gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-8 px-3 gap-1.5"
                        onClick={() => openManageDialog(u)}
                      >
                        <Edit className="h-3.5 w-3.5" /> 
                        <span className="sr-only sm:not-sr-only">Manage</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-8 px-3 gap-1.5"
                        onClick={() => resetOnboarding(u)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Reset</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 px-3 gap-1.5"
                        onClick={() => disableVenueRep(u)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Disable</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Local invite dialog removed in favor of canonical VenueRepInvitations */}

      {/* Manage assignments dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Venues {selectedRep ? `for ${selectedRep.displayName}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-y-auto">
              {venues.map((v) => (
                <div key={v.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`assign-${v.id}`}
                    checked={selectedVenueIds.includes(v.id)}
                    onCheckedChange={(checked) => toggleVenueSelection(v.id, checked === true)}
                  />
                  <label htmlFor={`assign-${v.id}`} className="text-sm cursor-pointer flex-1">{v.name}</label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveAssignments} disabled={savingAssignments} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                {savingAssignments ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <UserCog className="mr-2 h-4 w-4" /> Save Assignments
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setManageDialogOpen(false)} disabled={savingAssignments} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
