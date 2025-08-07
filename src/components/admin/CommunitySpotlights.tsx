'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Plus, Edit, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SpotlightForm } from '@/components/admin/SpotlightForm';
import { useToast } from '@/hooks/use-toast';
import type { CommunitySpotlight } from '@/lib/types';

export function CommunitySpotlights() {
  const [spotlights, setSpotlights] = useState<CommunitySpotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<CommunitySpotlight | null>(null);
  const [viewingSpotlight, setViewingSpotlight] = useState<CommunitySpotlight | null>(null);
  const { toast } = useToast();

  const activeSpotlight = spotlights.find(s => s.isActive);
  const inactiveSpotlights = spotlights.filter(s => !s.isActive);

  useEffect(() => {
    fetchSpotlights();
  }, []);

  const fetchSpotlights = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/spotlights');
      if (!response.ok) {
        throw new Error('Failed to fetch spotlights');
      }
      const data = await response.json();
      setSpotlights(data.spotlights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spotlights');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateSpotlight = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/spotlights/${id}/activate`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to activate spotlight');
      }
      await fetchSpotlights(); // Refresh data
    } catch (err) {
      console.error('Error activating spotlight:', err);
    }
  };

  const handleDeleteSpotlight = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/spotlights/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete spotlight');
      }
      await fetchSpotlights(); // Refresh data
      toast({
        title: 'Success!',
        description: 'Spotlight deleted successfully.',
      });
    } catch (err) {
      console.error('Error deleting spotlight:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete spotlight.',
        variant: 'destructive',
      });
    }
  };

  const handleSpotlightCreated = (newSpotlight: CommunitySpotlight) => {
    setSpotlights(prev => [newSpotlight, ...prev]);
    setIsCreateDialogOpen(false);
    toast({
      title: 'Success!',
      description: 'Community spotlight created successfully.',
    });
  };

  const handleSpotlightUpdated = (updatedSpotlight: CommunitySpotlight) => {
    setSpotlights(prev => 
      prev.map(s => s.id === updatedSpotlight.id ? updatedSpotlight : s)
    );
    setEditingSpotlight(null);
    toast({
      title: 'Success!',
      description: 'Community spotlight updated successfully.',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-headline mb-2">Community Spotlights</h2>
            <p className="text-muted-foreground">Manage featured community member spotlights</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Create Spotlight
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading spotlights...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-headline mb-2">Community Spotlights</h2>
            <p className="text-muted-foreground">Manage featured community member spotlights</p>
          </div>
          <Button onClick={fetchSpotlights}>
            <Plus className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">Error: {error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline mb-2">Community Spotlights</h2>
          <p className="text-muted-foreground">Manage featured community member spotlights</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Spotlight
          </Button>
        </Dialog>
      </div>

      {/* Current Spotlight */}
      {activeSpotlight ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Current Spotlight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-16 h-16 flex-shrink-0">
                {activeSpotlight.photoUrl ? (
                  <img 
                    src={activeSpotlight.photoUrl} 
                    alt={activeSpotlight.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold">
                    {activeSpotlight.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{activeSpotlight.name}</h3>
                <div className="flex flex-wrap gap-1 mb-2">
                  {activeSpotlight.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{activeSpotlight.story}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Created by {activeSpotlight.createdBy} • {new Date(activeSpotlight.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/" target="_blank">
                    <Eye className="mr-1 h-3 w-3" />
                    View Live
                  </a>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setViewingSpotlight(activeSpotlight)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingSpotlight(activeSpotlight)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => handleDeleteSpotlight(activeSpotlight.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-muted-foreground" />
              Current Spotlight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Star className="mx-auto h-12 w-12 mb-4" />
              <p>No active spotlight</p>
              <p className="text-sm">Create a new spotlight or activate an existing one</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Spotlights Management */}
      <Card>
        <CardHeader>
          <CardTitle>All Spotlights ({spotlights.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {spotlights.length === 0 ? (
            <div className="text-center py-12">
              <Star className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No spotlights created yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first community spotlight to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {spotlights.map((spotlight) => (
                <div key={spotlight.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="w-12 h-12 flex-shrink-0">
                    {spotlight.photoUrl ? (
                      <img 
                        src={spotlight.photoUrl} 
                        alt={spotlight.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {spotlight.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{spotlight.name}</h4>
                      {spotlight.isActive && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Star className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {spotlight.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {spotlight.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{spotlight.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{spotlight.story}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(spotlight.createdAt).toLocaleDateString()} • by {spotlight.createdBy}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!spotlight.isActive && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleActivateSpotlight(spotlight.id)}
                      >
                        <Star className="mr-1 h-3 w-3" />
                        Activate
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setViewingSpotlight(spotlight)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingSpotlight(spotlight)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {!spotlight.isActive && (
                          <DropdownMenuItem onClick={() => handleActivateSpotlight(spotlight.id)}>
                            <Star className="mr-2 h-4 w-4" />
                            Make Active
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleDeleteSpotlight(spotlight.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Spotlight Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Community Spotlight</DialogTitle>
          </DialogHeader>
          <SpotlightForm 
            onSuccess={handleSpotlightCreated}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Spotlight Dialog */}
      <Dialog open={!!editingSpotlight} onOpenChange={(open) => {
        if (!open) setEditingSpotlight(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Community Spotlight</DialogTitle>
          </DialogHeader>
          {editingSpotlight && (
            <SpotlightForm 
              spotlight={editingSpotlight}
              onSuccess={handleSpotlightUpdated}
              onCancel={() => setEditingSpotlight(null)}
              onDelete={handleDeleteSpotlight}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewingSpotlight} onOpenChange={(open) => {
        if (!open) setViewingSpotlight(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Spotlight Details</DialogTitle>
          </DialogHeader>
          {viewingSpotlight && (
            <div className="space-y-6">
              {/* Photo and Name */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 flex-shrink-0">
                  {viewingSpotlight.photoUrl ? (
                    <img 
                      src={viewingSpotlight.photoUrl} 
                      alt={viewingSpotlight.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {viewingSpotlight.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{viewingSpotlight.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {viewingSpotlight.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Story */}
              <div>
                <h4 className="font-medium mb-2">Story</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {viewingSpotlight.story}
                </p>
              </div>

              {/* Links */}
              {viewingSpotlight.links && (viewingSpotlight.links.website || viewingSpotlight.links.social) && (
                <div>
                  <h4 className="font-medium mb-2">Links</h4>
                  <div className="space-y-1">
                    {viewingSpotlight.links.website && (
                      <div>
                        <span className="text-sm font-medium">Website: </span>
                        <a href={viewingSpotlight.links.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                          {viewingSpotlight.links.website}
                        </a>
                      </div>
                    )}
                    {viewingSpotlight.links.social && (
                      <div>
                        <span className="text-sm font-medium">Social: </span>
                        <a href={viewingSpotlight.links.social} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                          {viewingSpotlight.links.social}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {viewingSpotlight.adminNotes && (
                <div>
                  <h4 className="font-medium mb-2">Admin Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {viewingSpotlight.adminNotes}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status: </span>
                    <Badge className={viewingSpotlight.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
                      {viewingSpotlight.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Created: </span>
                    <span className="text-muted-foreground">
                      {new Date(viewingSpotlight.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Created by: </span>
                    <span className="text-muted-foreground">{viewingSpotlight.createdBy}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setViewingSpotlight(null);
                    setEditingSpotlight(viewingSpotlight);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                {!viewingSpotlight.isActive && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      handleActivateSpotlight(viewingSpotlight.id);
                      setViewingSpotlight(null);
                    }}
                  >
                    <Star className="mr-2 h-4 w-4" />
                    Make Active
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewingSpotlight(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
