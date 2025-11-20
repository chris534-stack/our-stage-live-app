import { revalidatePath as nextRevalidatePath } from 'next/cache';

// Allow tests to inject a mock revalidatePath without relying on Next runtime
let testRevalidator: null | ((path: string) => any) = null;

export function setTestRevalidator(fn: ((path: string) => any) | null) {
  testRevalidator = fn;
}

export function revalidatePath(path: string): any {
  if (testRevalidator) {
    return testRevalidator(path);
  }
  // In Jest/test environments, do nothing by default to avoid Next runtime
  // NOTE: next/jest may load server-only code which throws outside Next runtime.
  // Guard here so action code remains testable without explicit mocks.
  const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
  if (isTestEnv) {
    return; // no-op in tests if not explicitly overridden
  }
  try {
    return nextRevalidatePath(path);
  } catch (_err) {
    // Swallow in non-test defensive case to avoid crashing callers
    return;
  }
}
