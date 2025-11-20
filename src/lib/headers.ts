import { headers as nextHeaders } from 'next/headers';
import fs from 'fs';
import path from 'path';

// Minimal Headers-like interface we use
type HeadersLike = { get(name: string): string | null };

let testGetter: null | (() => HeadersLike) = null;

// Allow tests to inject a headers provider without relying on Next runtime
export function setTestHeaders(getter: (() => HeadersLike) | null) {
  try {
    const p = path.join(process.cwd(), 'tmp-test-logs.txt');
    fs.appendFileSync(p, `[headers] setTestHeaders called -> ${!!getter}\n`);
  } catch {}
  testGetter = getter;
}

// Match the async usage pattern in actions (await headers())
export async function headers(): Promise<HeadersLike> {
  if (testGetter) {
    try {
      const p = path.join(process.cwd(), 'tmp-test-logs.txt');
      fs.appendFileSync(p, `[headers] using injected test headers\n`);
    } catch {}
    return testGetter();
  }
  // Delegate to Next's headers in real runtime
  try {
    const p = path.join(process.cwd(), 'tmp-test-logs.txt');
    fs.appendFileSync(p, `[headers] using Next headers fallback\n`);
  } catch {}
  return nextHeaders() as unknown as HeadersLike;
}
// Note: do not re-export Next's headers to avoid conflicts; consumers should import from this wrapper.
