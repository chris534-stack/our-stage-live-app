"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioQueue() {
  const [queue, setQueue] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    audioRef.current = new Audio();
    const a = audioRef.current;
    const onEnded = () => {
      idxRef.current += 1;
      if (idxRef.current < queue.length) {
        a.src = queue[idxRef.current];
        a.play().catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    };
    a.addEventListener("ended", onEnded);
    return () => {
      a.pause();
      a.removeEventListener("ended", onEnded);
    };
  }, [queue.length]);

  const play = useCallback((urls: string[]) => {
    if (!audioRef.current) return;
    idxRef.current = 0;
    setQueue(urls);
    const a = audioRef.current;
    if (!urls.length) return;
    a.src = urls[0];
    a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setIsPlaying(false);
  }, []);

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  return { play, stop, pause, resume, isPlaying } as const;
}
