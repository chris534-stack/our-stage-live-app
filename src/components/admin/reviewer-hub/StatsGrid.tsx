'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Clock, Mail, CheckCircle, XCircle, Users, TrendingUp } from 'lucide-react';

interface StatsGridProps {
  stats: {
    pendingApplications: number;
    pendingInvitations: number;
    approvedApplications: number;
    deniedApplications: number;
    activeReviewers: number;
    totalReviews: number;
  };
}

export function StatsGrid({ stats }: StatsGridProps) {
  const statItems = [
    {
      icon: Clock,
      value: stats.pendingApplications,
      label: 'Pending Applications',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      priority: 'high' as const
    },
    {
      icon: Mail,
      value: stats.pendingInvitations,
      label: 'Pending Invites',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      priority: 'high' as const
    },
    {
      icon: Users,
      value: stats.activeReviewers,
      label: 'Active Reviewers',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      priority: 'normal' as const
    },
    {
      icon: CheckCircle,
      value: stats.approvedApplications,
      label: 'Approved',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      priority: 'normal' as const
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {statItems.map((item, index) => {
        const Icon = item.icon;
        const isHighPriority = item.priority === 'high' && item.value > 0;
        
        return (
          <Card 
            key={index}
            className={`
              hover:shadow-md transition-all duration-200
              ${isHighPriority ? `${item.bgColor} ${item.borderColor} border-2` : 'hover:shadow-lg'}
              ${isHighPriority ? 'ring-2 ring-offset-1 ring-yellow-300/50' : ''}
            `}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col items-center text-center space-y-1 md:flex-row md:items-center md:space-y-0 md:space-x-3 md:text-left">
                <Icon 
                  className={`
                    h-6 w-6 md:h-8 md:w-8 flex-shrink-0
                    ${item.color}
                    ${isHighPriority ? 'animate-pulse' : ''}
                  `} 
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-center md:justify-start gap-1">
                    <p className={`
                      text-xl md:text-2xl font-bold
                      ${isHighPriority ? item.color : ''}
                    `}>
                      {item.value}
                    </p>
                    {isHighPriority && (
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <p className={`
                    text-xs md:text-sm leading-tight
                    ${isHighPriority ? item.color : 'text-muted-foreground'}
                  `}>
                    {item.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
