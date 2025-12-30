export function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}
