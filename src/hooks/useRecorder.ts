"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "stopped" | "error";

export function useRecorder(options?: { mimeType?: string }) {
  const mimeType = options?.mimeType || "audio/webm";
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && !!window.MediaRecorder);
  }, []);

  const start = useCallback(async () => {
    try {
      if (!isSupported) throw new Error("MediaRecorder not supported in this browser");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      mr.onstop = () => {
        // stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        setStatus("stopped");
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setStatus("recording");
    } catch (e) {
      console.warn("recorder start failed", e);
      setStatus("error");
      throw e;
    }
  }, [isSupported, mimeType]);

  const stop = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
  }, []);

  const getBlob = useCallback(() => {
    if (!chunksRef.current.length) return null;
    return new Blob(chunksRef.current, { type: mimeType });
  }, [mimeType]);

  const reset = useCallback(() => {
    chunksRef.current = [];
    setStatus("idle");
  }, []);

  return { status, isSupported, start, stop, getBlob, reset } as const;
}
