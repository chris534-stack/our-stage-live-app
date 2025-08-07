'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Search, Eye, Edit, MoreHorizontal, Loader2, UserCheck, UserX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';

type UserStats = {
  totalUsers: number;
  activeUsers: number;
  reviewers: number;
  admins: number;
};

export function UsersDirectory() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    reviewers: 0,
    admins: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/users/stats')
      ]);

      if (!usersResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [usersData, statsData] = await Promise.all([
        usersResponse.json(),
        statsResponse.json()
      ]);

      setUsers(usersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching users data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (user: UserProfile) => {
    setSelectedUser(user);
    setViewDetailsOpen(true);
  };

  const toggleReviewerStatus = async (user: UserProfile) => {
    const newStatus = !user.isReviewer;
    const action = newStatus ? 'grant' : 'remove';
    
    if (!confirm(`Are you sure you want to ${action} reviewer privileges for ${user.displayName}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users/reviewer-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          isReviewer: newStatus
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update reviewer status');
      }

      // Refresh the users list
      await fetchData();
      
      toast({
        title: 'Success!',
        description: `Reviewer privileges ${newStatus ? 'granted to' : 'removed from'} ${user.displayName}.`,
      });
    } catch (error) {
      console.error('Error updating reviewer status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update reviewer status.',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'Performer':
        return 'bg-purple-100 text-purple-800';
      case 'Director':
        return 'bg-blue-100 text-blue-800';
      case 'Designer':
        return 'bg-green-100 text-green-800';
      case 'Technician':
        return 'bg-orange-100 text-orange-800';
      case 'Audience':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-headline mb-2">Users Directory</h2>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Search users..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button className="sm:w-auto" disabled>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Active
              </Badge>
              <div>
                <p className="text-2xl font-bold">{stats.activeUsers}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Reviewers
              </Badge>
              <div>
                <p className="text-2xl font-bold">{stats.reviewers}</p>
                <p className="text-sm text-muted-foreground">Reviewers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Admins
              </Badge>
              <div>
                <p className="text-2xl font-bold">{stats.admins}</p>
                <p className="text-sm text-muted-foreground">Administrators</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No users found matching your search.' : 'No users found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.photoURL} alt={user.displayName} />
                      <AvatarFallback>
                        {user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{user.displayName}</h3>
                        {user.authStatus === 'notFound' && (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{user.showEmail ? user.email : 'Email hidden'}</span>
                        {user.roleInCommunity && (
                          <>
                            <span>•</span>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getRoleBadgeColor(user.roleInCommunity)}`}
                            >
                              {user.roleInCommunity}
                            </Badge>
                          </>
                        )}
                        {user.isReviewer && (
                          <>
                            <span>•</span>
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-blue-100 text-blue-800"
                            >
                              <UserCheck className="mr-1 h-3 w-3" />
                              Reviewer
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        console.log('User reviewer status:', user.displayName, user.isReviewer);
                        toggleReviewerStatus(user);
                      }}>
                        {user.isReviewer ? (
                          <>
                            <UserX className="mr-2 h-4 w-4" />
                            Remove Reviewer
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Grant Reviewer
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View detailed information about this user profile.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.photoURL} alt={selectedUser.displayName} />
                  <AvatarFallback className="text-lg">
                    {selectedUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedUser.displayName}</h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-1">
                    {selectedUser.roleInCommunity && (
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getRoleBadgeColor(selectedUser.roleInCommunity)}`}
                      >
                        {selectedUser.roleInCommunity}
                      </Badge>
                    )}
                    {selectedUser.isReviewer && (
                      <Badge 
                        variant="secondary" 
                        className="text-xs bg-blue-100 text-blue-800"
                      >
                        <UserCheck className="mr-1 h-3 w-3" />
                        Reviewer
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Account Status</h4>
                  <Badge 
                    variant="secondary" 
                    className={selectedUser.authStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                  >
                    {selectedUser.authStatus === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Email Visibility</h4>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                    {selectedUser.showEmail ? 'Public' : 'Private'}
                  </Badge>
                </div>
                
                {selectedUser.communityStartDate && (
                  <div>
                    <h4 className="font-medium mb-2">Community Start Date</h4>
                    <p className="text-sm text-muted-foreground">{selectedUser.communityStartDate}</p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium mb-2">Gallery Images</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.galleryImageUrls?.length || 0} images
                  </p>
                </div>
              </div>
              
              {selectedUser.bio && (
                <div>
                  <h4 className="font-medium mb-2">Bio</h4>
                  <p className="text-sm text-muted-foreground">{selectedUser.bio}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
