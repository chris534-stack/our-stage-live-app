'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, Clock, CheckCircle, UserPlus, Mail, 
  Star, Calendar, TrendingUp, Users, MessageSquare
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'review_created' | 'reviewer_joined' | 'application_approved' | 'invitation_sent' | 'invitation_accepted';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  metadata?: {
    eventTitle?: string;
    reviewRating?: number;
    invitationEmail?: string;
  };
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    newReviews: 0,
    newReviewers: 0,
    applications: 0,
    invitations: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real activity data from API
  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/admin/activity');
        if (!response.ok) {
          throw new Error('Failed to fetch activity data');
        }
        
        const data = await response.json();
        setActivities(data.activities || []);
        setMonthlyStats(data.monthlyStats || {
          newReviews: 0,
          newReviewers: 0,
          applications: 0,
          invitations: 0
        });
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activity data');
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, []);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'review_created':
        return <Star className="h-4 w-4 text-yellow-600" />;
      case 'reviewer_joined':
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'application_approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'invitation_sent':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'invitation_accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'review_created':
        return 'border-yellow-200 bg-yellow-50';
      case 'reviewer_joined':
      case 'application_approved':
      case 'invitation_accepted':
        return 'border-green-200 bg-green-50';
      case 'invitation_sent':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading activity feed...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading activities...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-600 mb-2">Failed to load activity data</p>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No recent activity</p>
              <p className="text-sm text-muted-foreground">
                Activity will appear here as reviewers join, post reviews, and interact with the platform.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`p-3 rounded-lg border-l-4 ${getActivityColor(activity.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {activity.title}
                        </h4>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTimeAgo(activity.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {activity.description}
                      </p>
                      
                      {/* Additional metadata */}
                      <div className="flex items-center gap-2 text-xs">
                        {activity.user && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {activity.user.name}
                          </span>
                        )}
                        
                        {activity.metadata?.reviewRating && (
                          <Badge variant="secondary" className="text-xs">
                            {activity.metadata.reviewRating} ⭐
                          </Badge>
                        )}
                        
                        {activity.metadata?.eventTitle && (
                          <span className="text-muted-foreground">
                            • {activity.metadata.eventTitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            This Month's Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{monthlyStats.newReviews}</div>
              <div className="text-xs text-muted-foreground">New Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{monthlyStats.newReviewers}</div>
              <div className="text-xs text-muted-foreground">New Reviewers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{monthlyStats.applications}</div>
              <div className="text-xs text-muted-foreground">Applications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{monthlyStats.invitations}</div>
              <div className="text-xs text-muted-foreground">Invitations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Quick Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Calculate insights from real data */}
            {(() => {
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const recentReviews = activities.filter(a => 
                a.type === 'review_created' && new Date(a.timestamp) >= weekAgo
              );
              const recentReviewers = activities.filter(a => 
                (a.type === 'reviewer_joined' || a.type === 'invitation_accepted') && 
                new Date(a.timestamp) >= weekAgo
              );
              
              // Calculate average rating from recent reviews
              const ratingsSum = activities
                .filter(a => a.type === 'review_created' && a.metadata?.reviewRating)
                .reduce((sum, a) => sum + (a.metadata?.reviewRating || 0), 0);
              const ratingsCount = activities
                .filter(a => a.type === 'review_created' && a.metadata?.reviewRating)
                .length;
              const avgRating = ratingsCount > 0 ? (ratingsSum / ratingsCount).toFixed(1) : '0';
              
              // Find most active reviewer
              const reviewerCounts = new Map<string, number>();
              activities
                .filter(a => a.type === 'review_created' && a.user?.name)
                .forEach(a => {
                  const name = a.user!.name;
                  reviewerCounts.set(name, (reviewerCounts.get(name) || 0) + 1);
                });
              
              const mostActiveReviewer = Array.from(reviewerCounts.entries())
                .sort((a, b) => b[1] - a[1])[0];
              
              return (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{monthlyStats.newReviews} reviews posted this month</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{recentReviewers.length} new reviewers joined in the last week</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Average review rating: {avgRating}/5 stars</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>
                      {mostActiveReviewer 
                        ? `Most active reviewer: ${mostActiveReviewer[0]} (${mostActiveReviewer[1]} reviews)`
                        : 'No review activity yet'
                      }
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
