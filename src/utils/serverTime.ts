// Server-time synchronization helper
// Prevents students from tampering with device clock
let serverOffsetMs = 0;
let hasSynced = false;

export async function syncServerTime(): Promise<number> {
  try {
    const start = Date.now();
    // Fast HEAD request to current origin
    const res = await fetch('/', { method: 'HEAD', cache: 'no-store' });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTimeMs = new Date(dateHeader).getTime();
      const roundTripMs = Date.now() - start;
      // Estimate server time adjusted for half of round trip latency
      serverOffsetMs = (serverTimeMs + Math.round(roundTripMs / 2)) - Date.now();
      hasSynced = true;
    }
  } catch {
    // If offline or network error, fallback to local clock
  }
  return serverOffsetMs;
}

// Immediately trigger background sync once
if (typeof window !== 'undefined') {
  syncServerTime().catch(() => {});
}

export function getServerNow(): Date {
  return new Date(Date.now() + serverOffsetMs);
}

export function isServerTimeSynced(): boolean {
  return hasSynced;
}

export function formatServerTimeString(date: Date = getServerNow()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatServerDateString(date: Date = getServerNow()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
