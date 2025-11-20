"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { getClientDb } from "@/lib/firebase";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileText, TrendingUp, Clock, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";

interface Script {
  id: string;
  title: string;
  uploadedAt: Date;
  sceneCount: number;
  myScenes: number;
  averageGrade?: number;
  lastRehearsed?: Date;
}

interface Scene {
  id: string;
  sceneNumber: string;
  title: string;
  lineCount: number;
  rehearsalCount: number;
  lastGrade?: number;
  lastRehearsed?: Date;
}

export default function LineNotesPage() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function loadScripts() {
      try {
        const db = getClientDb();
        const scriptsRef = collection(db, `users/${user.uid}/scripts`);
        const q = query(scriptsRef, orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);
        
        const loadedScripts: Script[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          uploadedAt: doc.data().uploadedAt?.toDate(),
          lastRehearsed: doc.data().lastRehearsed?.toDate(),
        } as Script));
        
        setScripts(loadedScripts);
      } catch (error) {
        console.error("Failed to load scripts:", error);
      } finally {
        setLoading(false);
      }
    }

    loadScripts();
  }, [user]);

  // Empty state - no scripts uploaded yet
  if (!loading && scripts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-6">
              <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
            </div>
          </div>
          
          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline">Ready to rehearse?</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Upload your script and start practicing
            </p>
          </div>

          {/* Quick Steps - Compact */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <p className="text-sm">Take a photo of your script</p>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <p className="text-sm">We'll organize everything for you</p>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <p className="text-sm">Practice and track your progress</p>
            </div>
          </div>

          {/* CTA Button - Prominent */}
          <div className="pt-2">
            <Button size="lg" className="w-full gap-2 text-base h-12" asChild>
              <Link href="/line-notes/upload">
                <Upload className="h-5 w-5" />
                Upload Your First Script
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard - show all scripts
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">My Scripts</h1>
          <p className="text-muted-foreground mt-1">
            {scripts.length} {scripts.length === 1 ? 'script' : 'scripts'} ready to rehearse
          </p>
        </div>
        <Button className="gap-2" asChild>
          <Link href="/line-notes/upload">
            <Plus className="h-4 w-4" />
            Upload Script
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scripts.map(script => (
            <Link key={script.id} href={`/line-notes/script/${script.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{script.title}</CardTitle>
                  <CardDescription>
                    {script.myScenes} of {script.sceneCount} scenes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Average Grade */}
                  {script.averageGrade !== undefined ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Average Grade</span>
                      <div className="flex items-center gap-2">
                        {script.averageGrade >= 80 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : script.averageGrade >= 60 ? (
                          <TrendingUp className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-bold">{script.averageGrade}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className="text-sm font-medium text-muted-foreground">Not rehearsed yet</span>
                    </div>
                  )}

                  {/* Last Rehearsed */}
                  {script.lastRehearsed && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        Last practiced {formatRelativeTime(script.lastRehearsed)}
                      </span>
                    </div>
                  )}

                  {/* Upload Date */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Uploaded {formatRelativeTime(script.uploadedAt)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
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
