"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientDb } from "@/lib/firebase";
import { doc, getDoc, collection, query, getDocs, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, PlayCircle, TrendingUp, CheckCircle2, AlertCircle, Clock, FileText, Trash2, MoreVertical } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Script {
  id: string;
  title: string;
  uploadedAt: Date;
  characterName?: string;
}

interface Scene {
  id: string;
  sceneNumber: string;
  title: string;
  lineCount: number;
  rehearsalCount: number;
  lastGrade?: number;
  lastRehearsed?: Date;
  status: 'not-started' | 'in-progress' | 'mastered';
}

export default function ScriptDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as string;

  const [script, setScript] = useState<Script | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user || !confirm('Are you sure you want to delete this script? This cannot be undone.')) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/scripts/${scriptId}/delete`, {
        method: 'DELETE',
        headers: {
          'x-user-id': user.uid,
        },
      });

      if (response.ok) {
        router.push('/line-notes');
      } else {
        alert('Failed to delete script');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete script');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!user || !scriptId) {
      setLoading(false);
      return;
    }

    async function loadScriptAndScenes() {
      try {
        const db = getClientDb();
        
        // Load script
        const scriptRef = doc(db, `users/${user.uid}/scripts/${scriptId}`);
        const scriptSnap = await getDoc(scriptRef);
        
        if (!scriptSnap.exists()) {
          router.push('/line-notes');
          return;
        }

        setScript({
          id: scriptSnap.id,
          ...scriptSnap.data(),
          uploadedAt: scriptSnap.data().uploadedAt?.toDate(),
        } as Script);

        // Load scenes
        const scenesRef = collection(db, `users/${user.uid}/scripts/${scriptId}/scenes`);
        const q = query(scenesRef, orderBy("sceneNumber", "asc"));
        const scenesSnap = await getDocs(q);
        
        const loadedScenes: Scene[] = scenesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastRehearsed: doc.data().lastRehearsed?.toDate(),
          status: getSceneStatus(doc.data().rehearsalCount, doc.data().lastGrade),
        } as Scene));

        setScenes(loadedScenes);
      } catch (error) {
        console.error("Failed to load script:", error);
      } finally {
        setLoading(false);
      }
    }

    loadScriptAndScenes();
  }, [user, scriptId, router]);

  function getSceneStatus(rehearsalCount: number, lastGrade?: number): Scene['status'] {
    if (rehearsalCount === 0) return 'not-started';
    if (lastGrade && lastGrade >= 90) return 'mastered';
    return 'in-progress';
  }

  function getGradeColor(grade: number) {
    if (grade >= 90) return 'text-green-600';
    if (grade >= 80) return 'text-green-500';
    if (grade >= 70) return 'text-yellow-500';
    if (grade >= 60) return 'text-orange-500';
    return 'text-red-500';
  }

  function getStatusBadge(status: Scene['status']) {
    switch (status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Mastered
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
            <TrendingUp className="h-3 w-3" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            <AlertCircle className="h-3 w-3" />
            Not Started
          </span>
        );
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!script) {
    return null;
  }

  const averageGrade = scenes.length > 0
    ? scenes.reduce((sum, s) => sum + (s.lastGrade || 0), 0) / scenes.filter(s => s.lastGrade).length
    : 0;

  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" asChild>
            <Link href="/line-notes">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={deleting}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Script
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline">{script.title}</h1>
          {script.characterName && (
            <p className="text-sm text-muted-foreground mt-1">
              Playing: <span className="font-medium">{script.characterName}</span>
            </p>
          )}
        </div>
      </div>

      {/* Stats Overview - Compact for mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Card className="p-3 sm:p-4">
          <CardDescription className="text-xs sm:text-sm">Scenes</CardDescription>
          <CardTitle className="text-xl sm:text-2xl mt-1">{scenes.length}</CardTitle>
        </Card>

        <Card className="p-3 sm:p-4">
          <CardDescription className="text-xs sm:text-sm">Avg Grade</CardDescription>
          <CardTitle className={`text-xl sm:text-2xl mt-1 ${averageGrade > 0 ? getGradeColor(averageGrade) : ''}`}>
            {averageGrade > 0 ? `${Math.round(averageGrade)}%` : '—'}
          </CardTitle>
        </Card>

        <Card className="p-3 sm:p-4">
          <CardDescription className="text-xs sm:text-sm">Mastered</CardDescription>
          <CardTitle className="text-xl sm:text-2xl mt-1">
            {scenes.filter(s => s.status === 'mastered').length}/{scenes.length}
          </CardTitle>
        </Card>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Your Scenes</h2>
        
        {scenes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No scenes found. The script is still being processed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenes.map(scene => (
              <Card key={scene.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Scene {scene.sceneNumber}
                      </CardTitle>
                      {scene.title && (
                        <CardDescription className="mt-1">{scene.title}</CardDescription>
                      )}
                    </div>
                    {getStatusBadge(scene.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Grade */}
                  {scene.lastGrade !== undefined ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Grade</span>
                      <span className={`text-2xl font-bold ${getGradeColor(scene.lastGrade)}`}>
                        {scene.lastGrade}%
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      Not rehearsed yet
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{scene.lineCount} lines</span>
                    <span>{scene.rehearsalCount} rehearsals</span>
                  </div>

                  {/* Last Rehearsed */}
                  {scene.lastRehearsed && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(scene.lastRehearsed)}
                    </div>
                  )}

                  {/* Rehearse Button */}
                  <Button 
                    className="w-full gap-2" 
                    variant={scene.rehearsalCount === 0 ? "default" : "outline"}
                    asChild
                  >
                    <Link href={`/line-notes/script/${scriptId}/scene/${scene.id}/rehearse`}>
                      <PlayCircle className="h-4 w-4" />
                      {scene.rehearsalCount === 0 ? 'Start Rehearsing' : 'Practice Again'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
