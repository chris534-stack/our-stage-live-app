'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  UserCheck, 
  MessageSquare, 
  Calendar, 
  Search, 
  Eye, 
  UserX, 
  UserPlus, 
  RefreshCw,
  AlertTriangle,
  MoreVertical
} from 'lucide-react';
import type { UserProfile } from '@/lib/types';

type ReviewerWithStats = UserProfile & { 
  reviewCount: number; 
  lastReviewDate?: string;
};

type ReviewerStats = {
  totalReviewers: number;
  activeReviewers: number;
  pendingApplications: number;
  totalReviews: number;
  reviewsThisMonth: number;
};

export default function ReviewerManagement() {
  const [reviewers, setReviewers] = useState<ReviewerWithStats[]>([]);
  const [stats, setStats] = useState<ReviewerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReviewers = async () => {
    try {
      const response = await fetch('/api/admin/reviewers');
      if (!response.ok) throw new Error('Failed to fetch reviewers');
      
      const data = await response.json();
      setReviewers(data.reviewers || []);
      setStats(data.stats || {
        totalReviewers: 0,
        activeReviewers: 0,
        pendingApplications: 0,
        totalReviews: 0,
        reviewsThisMonth: 0
      });
    } catch (error) {
      console.error('Error fetching reviewers:', error);
      toast({ title: 'Error', description: 'Failed to load reviewer data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewers();
  }, []);

  const handleUpdateReviewerStatus = async (reviewerId: string, isReviewer: boolean) => {
    try {
      const response = await fetch(`/api/admin/reviewers/${reviewerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isReviewer }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update reviewer status');
      }

      toast({
        title: 'Success',
        description: `Reviewer status has been ${isReviewer ? 'granted' : 'revoked'}.`,
      });

      // Update local state and refetch stats
      setReviewers(prev => prev.map(r => r.userId === reviewerId ? { ...r, isReviewer } : r));
      fetchReviewers(); // Refreshes stats and full list

    } catch (error) {
      console.error('Error updating reviewer status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    }
  };

  const filteredReviewers = reviewers.filter(reviewer =>
    reviewer.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reviewer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-headline">Reviewer Management</h2>
            <p className="text-muted-foreground">Manage reviewers and moderate reviews</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-headline">Reviewer Management</h2>
          <p className="text-muted-foreground">Manage reviewers and moderate reviews</p>
        </div>
        <Button onClick={fetchReviewers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Reviewers</p>
                  <p className="text-2xl font-bold">{stats.totalReviewers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Active Reviewers</p>
                  <p className="text-2xl font-bold">{stats.activeReviewers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold">{stats.totalReviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-orange-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Reviews This Month</p>
                  <p className="text-2xl font-bold">{stats.reviewsThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Pending Applications</p>
                  <p className="text-2xl font-bold">{stats.pendingApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Reviewers List */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Active Reviewers</CardTitle>
          <CardDescription>
            Manage reviewer status and monitor their activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search reviewers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="space-y-4">
              {filteredReviewers.length > 0 ? (
                filteredReviewers.map((reviewer) => (
                  <Card key={reviewer.userId} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      {/* Mobile-first responsive layout */}
                      <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
                        {/* Main reviewer info */}
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                            <AvatarImage src={reviewer.photoURL} />
                            <AvatarFallback className="text-sm sm:text-lg">
                              {reviewer.displayName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold truncate">{reviewer.displayName}</h3>
                            <p className="text-sm text-muted-foreground truncate">{reviewer.email}</p>
                            
                            {/* Stats on mobile */}
                            <div className="flex items-center space-x-4 text-xs sm:hidden text-muted-foreground mt-1">
                              <span>{reviewer.reviewCount || 0} reviews</span>
                              {reviewer.lastReviewDate && (
                                <span>Last: {formatDate(reviewer.lastReviewDate)}</span>
                              )}
                            </div>
                            
                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {reviewer.roleInCommunity && (
                                <Badge variant="secondary" className="text-xs">
                                  {reviewer.roleInCommunity}
                                </Badge>
                              )}
                              <Badge variant={reviewer.isReviewer ? "default" : "destructive"} className="text-xs">
                                {reviewer.isReviewer ? 'Active Reviewer' : 'Revoked'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop stats and actions */}
                        <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-4">
                          {/* Stats - hidden on mobile, shown on desktop */}
                          <div className="hidden sm:block text-right text-sm text-muted-foreground">
                            <p>{reviewer.reviewCount || 0} reviews</p>
                            {reviewer.lastReviewDate && (
                              <p>Last: {formatDate(reviewer.lastReviewDate)}</p>
                            )}
                          </div>
                          
                          {/* Action button */}
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" className="flex-shrink-0">
                              <Eye className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">View Details</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {reviewer.isReviewer ? (
                                  <DropdownMenuItem onSelect={() => handleUpdateReviewerStatus(reviewer.userId, false)} className="text-red-600">
                                    <UserX className="mr-2 h-4 w-4" />
                                    <span>Revoke Access</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => handleUpdateReviewerStatus(reviewer.userId, true)}>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    <span>Grant Access</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="text-gray-400 mb-4">
                      <Users className="h-12 w-12 mx-auto" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'No reviewers found' : 'No reviewers yet'}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 px-4">
                      {searchTerm 
                        ? 'Try adjusting your search terms to find reviewers.' 
                        : 'Reviewers will appear here once they are granted access.'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
