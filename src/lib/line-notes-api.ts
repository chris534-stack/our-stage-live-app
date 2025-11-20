export type IngestOcrRequest = {
  ownerId: string;
  scriptId?: string;
  rawText: string;
  name?: string;
};

export type IngestOcrResponse = {
  success: boolean;
  scriptId?: string;
  sceneId?: string;
  characters?: string[];
  error?: string;
};

export type TtsLineRequest = {
  text: string;
  voice?: string;
  ownerId: string;
  sceneId: string;
  lineId: string;
};

export type TtsLineResponse = {
  success: boolean;
  cached?: boolean;
  storagePath?: string | null;
  url?: string | null;
  vendor?: string;
  error?: string;
};

export type SttBatchRequest = {
  audioPaths: string[];
};

export type SttBatchResponse = {
  success: boolean;
  vendor?: string;
  transcript?: Array<{ ts: number; text: string }>;
  error?: string;
};

export type AlignNotesRequest = {
  expected: Array<{ id: string; speaker: string; text: string }>;
  transcript: Array<{ ts: number; text: string }>;
  role: string;
};

export type AlignNotesResponse = {
  success: boolean;
  notes?: Array<{
    lineId: string;
    score: number;
    missed?: string[];
    paraphrased?: string[];
    pickupDelayMs?: number;
    paceWpm?: number;
    feedback?: string;
  }>;
  error?: string;
};

function baseUrl() {
  const b = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
  if (!b) throw new Error("NEXT_PUBLIC_FUNCTIONS_BASE_URL is not configured");
  return b.replace(/\/$/, "");
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const resp = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as T;
  return data;
}

export async function ingestOcr(req: IngestOcrRequest): Promise<IngestOcrResponse> {
  return postJson<IngestOcrResponse>("/ingest_ocr", req);
}

export async function ttsLine(req: TtsLineRequest): Promise<TtsLineResponse> {
  return postJson<TtsLineResponse>("/tts_line", req);
}

export async function sttBatch(req: SttBatchRequest): Promise<SttBatchResponse> {
  return postJson<SttBatchResponse>("/stt_batch", req);
}

export async function alignNotes(req: AlignNotesRequest): Promise<AlignNotesResponse> {
  return postJson<AlignNotesResponse>("/align_notes", req);
}
