'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Mail,
  Database,
  Copy,
  ExternalLink,
  Loader2,
  Drama,
  CalendarDays
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PhotoUploadDebug } from './PhotoUploadDebug';
import { UploadCorruptionDiagnostic } from './UploadCorruptionDiagnostic';
import { UploadStressTester } from './UploadStressTester';
import Link from 'next/link';

interface DebugStats {
  totalInvitations: number;
  pendingInvitations: number;
  acceptedInvitations: number;
  expiredInvitations: number;
  averageAcceptanceTime: number;
  errorRate: number;
  healthScore: number;
}

interface TestInvitation {
  id: string;
  email: string;
  token: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export function SimplifiedDebugDashboard() {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [testInvitation, setTestInvitation] = useState<TestInvitation | null>(null);
  const [testEmail, setTestEmail] = useState('debug@test.com');
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    
    // Set up real-time monitoring if enabled
    let interval: NodeJS.Timeout;
    if (realTimeMonitoring) {
      interval = setInterval(fetchStats, 10000); // Update every 10 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realTimeMonitoring]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/debug/reviewer-invitation-stats');
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      } else {
        console.error('Failed to fetch stats:', response.status);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const createTestInvitation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/create-test-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTestInvitation({
          id: result.invitationId,
          email: result.email,
          token: result.token,
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: result.expiresAt,
        });
        
        toast({
          title: 'Test Invitation Created Successfully!',
          description: `Created invitation for ${result.email}`,
        });
        
        // Refresh stats after creating invitation
        fetchStats();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Failed to Create Test Invitation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (testInvitation) {
      const inviteUrl = `${window.location.origin}/invite/reviewer/${testInvitation.token}`;
      navigator.clipboard.writeText(inviteUrl);
      toast({
        title: 'Invite Link Copied!',
        description: 'The invitation URL has been copied to your clipboard.',
      });
    }
  };

  const openInviteLink = () => {
    if (testInvitation) {
      const inviteUrl = `${window.location.origin}/invite/reviewer/${testInvitation.token}`;
      window.open(inviteUrl, '_blank');
    }
  };

  const copyOnboardingLink = () => {
    const url = `${window.location.origin}/calendar?onboarding=venue-rep`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Onboarding Link Copied',
      description: 'The calendar onboarding URL has been copied.',
    });
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreBadge = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reviewer Invitation Debug Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and test your reviewer invitation pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setRealTimeMonitoring(!realTimeMonitoring)}
            variant={realTimeMonitoring ? 'default' : 'outline'}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${realTimeMonitoring ? 'animate-spin' : ''}`} />
            Real-time Monitoring
          </Button>
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {statsLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading statistics...</p>
          </CardContent>
        </Card>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invitations</p>
                  <p className="text-2xl font-bold">{stats.totalInvitations}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.totalInvitations > 0 
                      ? Math.round((stats.acceptedInvitations / stats.totalInvitations) * 100)
                      : 0}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Accept Time</p>
                  <p className="text-2xl font-bold">{stats.averageAcceptanceTime}h</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Health Score</p>
                  <p className={`text-2xl font-bold ${getHealthScoreColor(stats.healthScore)}`}>
                    {stats.healthScore}/100
                  </p>
                </div>
                <Database className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unable to load statistics. Please check your API endpoints.
          </AlertDescription>
        </Alert>
      )}

      {/* Test Invitation Creator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test Invitation Creator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Test Email</Label>
              <Input
                id="test-email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="debug@test.com"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={createTestInvitation} 
                disabled={loading || !testEmail.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Create Test Invitation
                  </>
                )}
              </Button>
            </div>
          </div>

          {testInvitation && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-3">✅ Test Invitation Created Successfully!</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Email:</span> {testInvitation.email}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <Badge variant="secondary">{testInvitation.status}</Badge>
                </div>
                <div>
                  <span className="font-medium">Token:</span> {testInvitation.token.substring(0, 16)}...
                </div>
                <div>
                  <span className="font-medium">Expires:</span> {new Date(testInvitation.expiresAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={copyInviteLink} size="sm" variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Invite Link
                </Button>
                <Button onClick={openInviteLink} size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Test Invite Link
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Notes (Internal) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Drama className="h-5 w-5" />
            Line Notes Sandbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Work-in-progress rehearsal tool. Hidden from end users; access it here while we finish the launch flow.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/line-notes">
                Open Line Notes
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="/line-notes" target="_blank" rel="noopener noreferrer">
                Open in New Tab
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Tester */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Onboarding Tester (Venue Rep)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Launch the calendar with onboarding mode to preview the venue rep intro dialog.
          </p>
          <div className="rounded-md border p-3 bg-muted/30 text-sm">
            <p className="font-medium">Welcome, Venue Representative</p>
            <p className="text-muted-foreground">
              Manage events for your assigned venues. You can add new shows, update details, and keep the calendar up to date.
            </p>
            <ul className="list-disc pl-5 mt-2 text-muted-foreground">
              <li>Step 1: Add your first event for one of your venues.</li>
              <li>Step 2: Edit existing events as needed.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/calendar?onboarding=venue-rep">
                Open Calendar (Onboarding Mode)
              </Link>
            </Button>
            <Button variant="outline" onClick={copyOnboardingLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Test Link
            </Button>
            <Button variant="outline" asChild>
              <a href="/calendar?onboarding=venue-rep" target="_blank" rel="noopener noreferrer">
                Open in New Tab
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
          <Alert className="mt-2">
            <AlertDescription className="text-xs">
              Note: The onboarding dialog only appears if your account has the Venue Rep role. Otherwise, the calendar will open normally.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* System Health */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Overall Health Score</span>
                <Badge variant={getHealthScoreBadge(stats.healthScore)}>
                  {stats.healthScore}/100
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between">
                  <span>Pending:</span>
                  <span className="font-medium">{stats.pendingInvitations}</span>
                </div>
                <div className="flex justify-between">
                  <span>Accepted:</span>
                  <span className="font-medium text-green-600">{stats.acceptedInvitations}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expired:</span>
                  <span className="font-medium text-red-600">{stats.expiredInvitations}</span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span>Error Rate:</span>
                <span className={`font-medium ${stats.errorRate < 5 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.errorRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo Upload Debug Tools */}
      <div className="space-y-4">
        <PhotoUploadDebug />
        <UploadCorruptionDiagnostic />
        <UploadStressTester />
      </div>

      {/* Status Summary */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Debug Tools Status:</strong> Both reviewer invitation and photo upload debugging tools are available. 
          The reviewer invitation system is working correctly, and photo upload debugging can help diagnose client-side crashes.
          {stats && stats.healthScore >= 80 && (
            <span className="text-green-600 ml-2">✨ Excellent health score!</span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}






