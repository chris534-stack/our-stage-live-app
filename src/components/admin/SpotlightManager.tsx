'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SpotlightForm } from '@/components/admin/SpotlightForm';
import type { CommunitySpotlight } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface SpotlightManagerProps {
  initialSpotlights: CommunitySpotlight[];
}

export function SpotlightManager({ initialSpotlights }: SpotlightManagerProps) {
  const [spotlights, setSpotlights] = useState<CommunitySpotlight[]>(initialSpotlights);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<CommunitySpotlight | null>(null);
  const { toast } = useToast();

  const activeSpotlight = spotlights.find(s => s.isActive);

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

  const handleSpotlightDeleted = (deletedId: string) => {
    setSpotlights(prev => prev.filter(s => s.id !== deletedId));
    toast({
      title: 'Success!',
      description: 'Community spotlight deleted successfully.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Create New Spotlight Button */}
      <div className="flex justify-between items-center">
        <div>
          {activeSpotlight && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>Currently featuring: <strong>{activeSpotlight.name}</strong></span>
            </div>
          )}
          {!activeSpotlight && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <EyeOff className="h-4 w-4" />
              <span>No active spotlight</span>
            </div>
          )}
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Spotlight
            </Button>
          </DialogTrigger>
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
      </div>

      {/* Spotlights List */}
      <div className="space-y-4">
        {spotlights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">No spotlights yet</h3>
                <p className="text-muted-foreground">
                  Create your first community spotlight to recognize someone special!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          spotlights.map((spotlight) => (
            <Card key={spotlight.id} className={`${spotlight.isActive ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg truncate">{spotlight.name}</CardTitle>
                      {spotlight.isActive && (
                        <Badge variant="default" className="shrink-0">Active</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      Created {new Date(spotlight.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  
                  {spotlight.photoUrl && (
                    <div className="shrink-0">
                      <img 
                        src={spotlight.photoUrl} 
                        alt={spotlight.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Tags */}
                {spotlight.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {spotlight.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Story Preview */}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {spotlight.story}
                </p>
                
                {/* Links */}
                {spotlight.links && (spotlight.links.website || spotlight.links.social) && (
                  <div className="text-xs text-muted-foreground">
                    Links included: {spotlight.links.website && 'Website'} {spotlight.links.website && spotlight.links.social && '• '} {spotlight.links.social && 'Social'}
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Dialog open={editingSpotlight?.id === spotlight.id} onOpenChange={(open) => {
                    if (!open) setEditingSpotlight(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => setEditingSpotlight(spotlight)}
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Community Spotlight</DialogTitle>
                      </DialogHeader>
                      {editingSpotlight && (
                        <SpotlightForm 
                          spotlight={editingSpotlight}
                          onSuccess={handleSpotlightUpdated}
                          onCancel={() => setEditingSpotlight(null)}
                          onDelete={handleSpotlightDeleted}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
