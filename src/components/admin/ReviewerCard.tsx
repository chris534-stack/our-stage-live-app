'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye, UserX, UserPlus } from 'lucide-react';

interface ReviewerCardProps {
  reviewer: any;
  onToggleStatus: (userId: string, currentStatus: boolean) => void;
  onViewDetails: (reviewer: any) => void;
  formatDate: (dateString: string) => string;
  children?: React.ReactNode; // For dialog content
}

export default function ReviewerCard({ 
  reviewer, 
  onToggleStatus, 
  onViewDetails, 
  formatDate,
  children 
}: ReviewerCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Header with avatar and basic info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
              <AvatarImage src={reviewer.photoURL} />
              <AvatarFallback className="text-sm font-medium">
                {reviewer.displayName.split(' ').map((n: string) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">
                    {reviewer.displayName}
                  </h3>
                  <p className="text-sm text-gray-600 truncate">{reviewer.email}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                  {reviewer.roleInCommunity && (
                    <Badge variant="secondary" className="text-xs">
                      {reviewer.roleInCommunity}
                    </Badge>
                  )}
                  {reviewer.isReviewer && (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                      Active Reviewer
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats section */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="text-center flex-1">
              <p className="text-lg sm:text-xl font-bold text-gray-900">{reviewer.reviewCount}</p>
              <p className="text-xs text-gray-600">Reviews</p>
            </div>
            {reviewer.lastReviewDate && (
              <div className="text-center flex-1 border-l border-gray-200 pl-3">
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(reviewer.lastReviewDate)}
                </p>
                <p className="text-xs text-gray-600">Last Review</p>
              </div>
            )}
          </div>

          {/* Action buttons - full width on mobile */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex-1 sm:flex-none justify-center"
                  onClick={() => onViewDetails(reviewer)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </DialogTrigger>
              {children}
            </Dialog>
            
            <Button
              onClick={() => onToggleStatus(reviewer.userId, reviewer.isReviewer || false)}
              variant={reviewer.isReviewer ? "destructive" : "default"}
              className="flex-1 sm:flex-none justify-center"
            >
              {reviewer.isReviewer ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Revoke Access
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Reinstate Access
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
