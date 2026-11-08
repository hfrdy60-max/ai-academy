// Best-effort sliding-window limiter kept in memory. Cloudflare may run several Worker
// instances, so this is a first line of defence, not a hard guarantee (see SECURITY.md).
const hits = new Map<string, number[]>();

export function allowRequest(key: string, limitPerMinute: number, now = Date.now()): boolean {
  const windowStart = now - 60_000;
  const recent = (hits.get(key) ?? []).filter(t => t > windowStart);
  if (recent.length >= limitPerMinute) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v[v.length - 1] <= windowStart) hits.delete(k);
  return true;
}

export const resetRateLimit = (): void => hits.clear(); // for tests
