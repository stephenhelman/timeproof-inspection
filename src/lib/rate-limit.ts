type Entry = { count: number; resetAt: number };

// In-memory store — works for single-instance Node.js deployment.
const store = new Map<string, Entry>();

export function checkRateLimit(
  ip: string,
  key: string,
  max: number,
  windowSecs = 60,
): { ok: boolean; retryAfter: number } {
  const k = `${key}:${ip}`;
  const now = Date.now();
  let entry = store.get(k);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowSecs * 1000 };
    store.set(k, entry);
  }

  entry.count++;

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  return { ok: true, retryAfter: 0 };
}

export function getRequestIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
