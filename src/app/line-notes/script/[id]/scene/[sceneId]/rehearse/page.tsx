"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PlayCircle, PauseCircle, Mic, MicOff, SkipForward, RotateCcw } from "lucide-react";
import Link from "next/link";
import { TTSResult, useTextToSpeech } from "@/hooks/useTextToSpeech";

type RawLine = {
  character: string;
  dialogue: string;
  lineNumber: number;
};

type SceneDocument = {
  id: string;
  sceneNumber: string;
  title?: string;
  lines: RawLine[];
  characters?: string[];
};

type PlayableLine = RawLine & {
  actorType: "user" | "partner";
};

interface SpeechSegment {
  id: string;
  startIndex: number;
  endIndex: number; // inclusive
  text: string;
  speakers: string[];
  voiceId: string;
  entries: SpeechSegmentEntry[];
}

interface SpeechSegmentEntry {
  character: string;
  dialogue: string;
  voiceId: string;
}

interface SegmentSpeakerConfig {
  name: string;
  voiceId: string;
}

function extractSpeakerConfigs(segment: SpeechSegment): SegmentSpeakerConfig[] {
  const seen = new Map<string, string>();

  segment.entries.forEach((entry) => {
    const name = entry.character || "Unknown";
    if (!seen.has(name)) {
      seen.set(name, entry.voiceId || segment.voiceId);
    }
  });

  return Array.from(seen.entries()).map(([name, voiceId]) => ({ name, voiceId }));
}

const VOICE_FALLBACK_ORDER = [
  "elderly_male_wise",
  "elderly_female_wise",
  "mature_male_authority",
  "mature_female_authority",
  "young_male_hero",
  "young_female_ingenue",
  "young_female_confident",
  "comedic_male",
  "comedic_female",
  "villain_male",
  "villain_female",
  "child_female",
];

const MAX_SEGMENT_CHAR_LENGTH = 320;
const MAX_SEGMENT_LINES = 3;

function determineVoicePreferences(characterName: string): string[] {
  const name = (characterName || "").toLowerCase();
  const preferences: string[] = [];

  if (/grand(pa|father)/.test(name)) {
    preferences.push("elderly_male_wise");
  }
  if (/grand(ma|mother)/.test(name)) {
    preferences.push("elderly_female_wise");
  }
  if (/(father|dad|sir|mr\.?)/.test(name)) {
    preferences.push("mature_male_authority");
  }
  if (/(mother|mom|mrs\.?|lady|madam)/.test(name)) {
    preferences.push("mature_female_authority");
  }
  if (/(boy|son|brother|prince|hero)/.test(name)) {
    preferences.push("young_male_hero");
  }
  if (/(girl|daughter|sister|princess|queen)/.test(name)) {
    preferences.push("young_female_ingenue");
  }
  if (/(villain|evil|dark lord|hench)/.test(name)) {
    preferences.push("villain_male");
  }
  if (/(witch|crone|villainess)/.test(name)) {
    preferences.push("villain_female");
  }
  if (/(clown|jester|comic|funny|family)/.test(name)) {
    preferences.push("comedic_male", "comedic_female");
  }
  if (/(narrator|guide|teacher|coach)/.test(name)) {
    preferences.push("mature_male_authority");
  }

  return preferences;
}

export default function RehearsePage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as string;
  const sceneId = params.sceneId as string;

  const [scene, setScene] = useState<SceneDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [selectingCharacter, setSelectingCharacter] = useState(true);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [segments, setSegments] = useState<SpeechSegment[]>([]);
  const segmentCache = useRef<Map<string, Promise<TTSResult | null>>>(new Map());
  const [isPaused, setIsPaused] = useState(false);

  const stopCurrentAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    audioRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const { generateSpeech, loading: ttsLoading } = useTextToSpeech();

  useEffect(() => {
    if (!user || !scriptId || !sceneId) {
      setLoading(false);
      return;
    }

    const uid = user.uid;

    async function loadScene() {
      try {
        const db = getClientDb();
        const sceneRef = doc(db, `users/${uid}/scripts/${scriptId}/scenes/${sceneId}`);
        const sceneSnap = await getDoc(sceneRef);
        
        if (!sceneSnap.exists()) {
          router.push(`/line-notes/script/${scriptId}`);
          return;
        }

        const data = sceneSnap.data() as Partial<SceneDocument> & { lines?: RawLine[]; sceneHeading?: string };
        const lines = (data.lines ?? []) as RawLine[];
        const characters = data.characters ?? Array.from(new Set(lines.map((line) => line.character).filter(Boolean)));

        stopCurrentAudio();
        setSelectedCharacters([]);
        setCurrentLineIndex(0);
        setSelectingCharacter(true);
        setIsPaused(false);

        setScene({
          id: sceneSnap.id,
          sceneNumber: data.sceneNumber ?? sceneSnap.id,
          title: data.sceneHeading || data.title,
          lines,
          characters,
        });
      } catch (error) {
        console.error("Failed to load scene:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadScene();
  }, [user, scriptId, sceneId, router, stopCurrentAudio]);
  const availableCharacters = useMemo(() => {
    const charactersFromScene = scene?.characters ?? [];
    if (charactersFromScene.length > 0) {
      return [...charactersFromScene].sort((a, b) => a.localeCompare(b));
    }

    const chars = new Set<string>();
    scene?.lines.forEach((line) => {
      const characterName = line.character?.trim();
      if (characterName) {
        chars.add(characterName);
      }
    });
    return Array.from(chars).sort((a, b) => a.localeCompare(b));
  }, [scene]);

  const characterVoiceMap = useMemo(() => {
    const assignments = new Map<string, string>();
    const usedVoices = new Set<string>();

    availableCharacters.forEach((character) => {
      const preferences = determineVoicePreferences(character);
      let chosenVoice = preferences.find((voiceId) => !usedVoices.has(voiceId));

      if (!chosenVoice) {
        chosenVoice = VOICE_FALLBACK_ORDER.find((voiceId) => !usedVoices.has(voiceId));
      }

      if (!chosenVoice) {
        chosenVoice = preferences[0] || VOICE_FALLBACK_ORDER[0];
      }

      if (chosenVoice) {
        usedVoices.add(chosenVoice);
        assignments.set(character, chosenVoice);
      }
    });

    return assignments;
  }, [availableCharacters]);

  const playableLines: PlayableLine[] = useMemo(() => {
    if (!scene) return [];

    const userCharacters = new Set(selectedCharacters);

    return scene.lines.map((line) => ({
      ...line,
      actorType: userCharacters.has(line.character) ? "user" : "partner",
    }));
  }, [scene, selectedCharacters]);

  const currentLine = playableLines[currentLineIndex];
  const isLastLine = currentLineIndex === playableLines.length - 1;

  const getVoiceIdForLine = useCallback(
    (line: PlayableLine) => characterVoiceMap.get(line.character) || VOICE_FALLBACK_ORDER[4],
    [characterVoiceMap]
  );

  const buildSegments = useCallback((): SpeechSegment[] => {
    if (playableLines.length === 0) return [];
    const result: SpeechSegment[] = [];
    let index = 0;

    while (index < playableLines.length) {
      const line = playableLines[index];
      if (!line || line.actorType === "user") {
        index += 1;
        continue;
      }

      let end = index;
      const linesInSegment: PlayableLine[] = [line];
      const speakers = new Set<string>([line.character]);
      let charLength = line.dialogue.length;

      for (let j = index + 1; j < playableLines.length; j += 1) {
        const next = playableLines[j];
        if (!next || next.actorType === "user") break;
        const projectedCharLength = charLength + 1 + next.dialogue.length;
        if (
          linesInSegment.length >= MAX_SEGMENT_LINES ||
          projectedCharLength > MAX_SEGMENT_CHAR_LENGTH
        ) {
          break;
        }
        linesInSegment.push(next);
        speakers.add(next.character);
        end = j;
        charLength = projectedCharLength;
      }

      const primaryVoice = getVoiceIdForLine(line);
      const entries: SpeechSegmentEntry[] = linesInSegment.map((part) => ({
        character: part.character || "Unknown",
        dialogue: part.dialogue,
        voiceId: getVoiceIdForLine(part),
      }));
      const segmentText = linesInSegment
        .map((part) => `${part.character || "Unknown"}: ${part.dialogue}`)
        .join("\n");

      result.push({
        id: `${scriptId}-${sceneId}-${index}-${end}`,
        startIndex: index,
        endIndex: end,
        text: segmentText,
        speakers: Array.from(speakers),
        voiceId: primaryVoice,
        entries,
      });

      index = end + 1;
    }

    return result;
  }, [playableLines, scriptId, sceneId, getVoiceIdForLine]);

  useEffect(() => {
    setSegments(buildSegments());
    segmentCache.current.clear();
  }, [buildSegments]);

  const fetchSegmentAudio = useCallback(
    async (
      segment: SpeechSegment,
      background = false,
      speakerOverrides?: SegmentSpeakerConfig[]
    ): Promise<TTSResult | null> => {
      const existing = segmentCache.current.get(segment.id);
      if (existing) {
        return existing;
      }

      const speakerConfigs = speakerOverrides ?? extractSpeakerConfigs(segment);

      const request = generateSpeech(
        {
          text: segment.text,
          voiceId: segment.voiceId,
          characterName: segment.entries[0]?.character,
          showId: scriptId,
          speakers: speakerConfigs,
        },
        { background }
      );

      segmentCache.current.set(segment.id, request);
      return request;
    },
    [generateSpeech, scriptId]
  );

  const findSegmentForLine = useCallback(
    (lineIndex: number): SpeechSegment | undefined =>
      segments.find((segment) => lineIndex >= segment.startIndex && lineIndex <= segment.endIndex),
    [segments]
  );

  const handleCharacterToggle = useCallback((character: string, checked: boolean) => {
    setSelectedCharacters((prev) => {
      if (checked) {
        if (prev.includes(character)) return prev;
        return [...prev, character];
      }
      return prev.filter((item) => item !== character);
    });
  }, []);

  const handlePlayLine = useCallback(
    async (line: PlayableLine, index: number) => {
      if (!line || line.actorType !== "partner") return;

      const segment = findSegmentForLine(index);
      if (!segment) return;

      stopCurrentAudio();
      setIsPlaying(true);
      setIsPaused(false);

      try {
        const speakerConfigs = extractSpeakerConfigs(segment);
        const result = await fetchSegmentAudio(segment, false, speakerConfigs);

        if (result) {
          console.debug("[Audio] TTS metadata", {
            mimeType: result.mimeType,
            fileSize: result.fileSize,
            rawUrlPrefix: result.rawAudioUrl?.slice(0, 40),
            segmentId: segment.id,
            speakers: segment.speakers,
            voiceId: segment.voiceId,
            allocations: speakerConfigs,
          });

          const audio = new Audio(result.audioUrl);
          audioRef.current = audio;
          setIsPaused(false);

          audio.onerror = (e) => {
            const mediaError = audio.error;
            console.error("[Audio] Playback error:", {
              event: e,
              code: mediaError?.code,
              message: mediaError?.message,
              src: audio.currentSrc,
              networkState: audio.networkState,
              readyState: audio.readyState,
            });
            setIsPlaying(false);
            setIsPaused(false);
          };

          audio.onended = () => {
            setIsPlaying(false);
            setIsPaused(false);
            const nextIndex = segment.endIndex + 1;
            if (nextIndex < playableLines.length) {
              setTimeout(() => {
                setCurrentLineIndex(nextIndex);
                const nextLine = playableLines[nextIndex];
                if (nextLine?.actorType === "partner") {
                  void handlePlayLine(nextLine, nextIndex);
                } else {
                  setIsPlaying(false);
                  setIsPaused(false);
                }
              }, 20);
            }
            audioRef.current = null;
          };

          await audio.play();
        }
      } catch (error) {
        console.error("Failed to generate speech:", error);
        setIsPlaying(false);
      }
    },
    [fetchSegmentAudio, findSegmentForLine, playableLines.length, stopCurrentAudio]
  );

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      const line = playableLines[currentLineIndex];
      if (line && line.actorType === "partner") {
        await handlePlayLine(line, currentLineIndex);
      }
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
    } catch (error) {
      console.error("Failed to resume audio:", error);
    }
  }, [currentLineIndex, handlePlayLine, playableLines]);

  const playFromCurrentLine = useCallback(async (startIndex: number) => {
    const line = playableLines[startIndex];
    if (!line) return;

    setCurrentLineIndex(startIndex);

    if (line.actorType === "partner") {
      await handlePlayLine(line, startIndex);
    } else {
      setIsPlaying(false);
    }
  }, [handlePlayLine, playableLines]);

  useEffect(() => {
    if (selectingCharacter || isPaused) return;
    if (isPlaying || audioRef.current) return;
    const line = playableLines[currentLineIndex];
    if (line?.actorType === "partner") {
      void handlePlayLine(line, currentLineIndex);
    }
  }, [currentLineIndex, handlePlayLine, isPaused, isPlaying, playableLines, selectingCharacter]);

  useEffect(() => {
    if (selectingCharacter) return;
    const nextSegment = findSegmentForLine(currentLineIndex);
    if (!nextSegment) return;

    const subsequent = segments.filter((segment) => segment.startIndex > nextSegment.startIndex).slice(0, 2);
    subsequent.forEach((segment) => {
      void fetchSegmentAudio(segment, true);
    });
  }, [currentLineIndex, fetchSegmentAudio, findSegmentForLine, segments, selectingCharacter]);

  const handleNext = () => {
    if (isLastLine) return;
    const nextIndex = currentLineIndex + 1;
    stopCurrentAudio();
    setCurrentLineIndex(nextIndex);
    setIsPaused(false);
    const nextLine = playableLines[nextIndex];
    if (nextLine?.actorType === "partner") {
      void handlePlayLine(nextLine, nextIndex);
    }
  };

  const handleRestart = () => {
    stopCurrentAudio();
    setCurrentLineIndex(0);
    setIsPaused(false);
    void playFromCurrentLine(0);
  };

  const toggleMic = () => {
    setIsMicEnabled(!isMicEnabled);
    // TODO: Implement actual mic recording
  };

  useEffect(() => {
    return () => {
      stopCurrentAudio();
      setIsPaused(false);
    };
  }, [stopCurrentAudio]);

  const handleStartRehearsal = () => {
    if (selectedCharacters.length === 0) {
      return;
    }
    setSelectingCharacter(false);
    setCurrentLineIndex(0);
    stopCurrentAudio();
    void playFromCurrentLine(0);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && selectedCharacters.length === 0) {
      return;
    }
    setSelectingCharacter(open);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!scene) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" className="gap-2 mb-4" asChild>
          <Link href={`/line-notes/script/${scriptId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Script
          </Link>
        </Button>
        
        <h1 className="text-2xl font-bold font-headline">
          Scene {scene.sceneNumber} Rehearsal
        </h1>
        {scene.title && (
          <p className="text-muted-foreground mt-1">{scene.title}</p>
        )}
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Line {currentLineIndex + 1} of {playableLines.length}</span>
          <span>{playableLines.length ? Math.round(((currentLineIndex + 1) / playableLines.length) * 100) : 0}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: playableLines.length ? `${((currentLineIndex + 1) / playableLines.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Current Line Display */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {currentLine?.character || "Narrator"}
            </CardTitle>
            {currentLine?.actorType === "user" && (
              <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                Your Line
              </span>
            )}
            {currentLine && currentLine.actorType === "partner" && (
              <span className="text-xs text-muted-foreground">
                Voice: {characterVoiceMap.get(currentLine.character) || "default"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg leading-relaxed">
            {currentLine?.dialogue}
          </p>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="space-y-4">
        {currentLine?.actorType === "user" ? (
          // User's line - show mic controls
          <Card>
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  This is your line. Click the mic to record your delivery.
                </p>
                <Button
                  size="lg"
                  variant={isMicEnabled ? "destructive" : "default"}
                  className="gap-2"
                  onClick={toggleMic}
                >
                  {isMicEnabled ? (
                    <>
                      <MicOff className="h-5 w-5" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5" />
                      Start Recording
                    </>
                  )}
                </Button>
                {isMicEnabled && (
                  <div className="flex items-center justify-center gap-2 text-red-500">
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium">Recording...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          // Other character's line - show play controls
          <Card>
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Listen to the cue line, then respond when it's your turn.
                </p>
                {isPlaying ? (
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={handlePause}
                  >
                    <PauseCircle className="h-5 w-5" />
                    Pause
                  </Button>
                ) : isPaused ? (
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={handleResume}
                    disabled={ttsLoading}
                  >
                    <PlayCircle className="h-5 w-5" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => handlePlayLine(currentLine, currentLineIndex)}
                    disabled={ttsLoading}
                  >
                    <PlayCircle className="h-5 w-5" />
                    Play Segment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleRestart}
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleNext}
            disabled={isLastLine}
          >
            <SkipForward className="h-4 w-4" />
            Next Line
          </Button>
        </div>

        {/* Finish */}
        {isLastLine && (
          <Button
            size="lg"
            className="w-full"
            asChild
          >
            <Link href={`/line-notes/script/${scriptId}`}>
              Finish Rehearsal
            </Link>
          </Button>
        )}
      </div>

      {/* Audio element managed imperatively via audioRef */}
    </div>
  );
}
