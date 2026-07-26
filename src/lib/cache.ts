const CACHE_PREFIX = 'nightos:cache:';

export interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

export function cacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return undefined;
    }
    return entry.data as T;
  } catch {
    return undefined;
  }
}

export function cacheSet(key: string, data: unknown, ttlMs: number): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, expiresAt: Date.now() + ttlMs }),
    );
  } catch {
    /** silently fail */
  }
}

export function cacheInvalidate(prefix: string): void {
  try {
    const fullPrefix = CACHE_PREFIX + prefix;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /** silently fail */
  }
}

export function cacheClear(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /** silently fail */
  }
}

export const TTL = {
  VENUE: 5 * 60 * 1000,
  MENU: 2 * 60 * 1000,
  PRODUCT: 60 * 1000,
  BILL: 30 * 1000,
  ORDERS: 30 * 1000,
  STAFF: 2 * 60 * 1000,
  DASHBOARD: 30 * 1000,
} as const;

export async function cached<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  key: string,
  ttl: number,
): Promise<{ data: T | null; error: unknown }> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return { data: hit, error: null };
  const result = await queryFn();
  if (!result.error && result.data !== null && result.data !== undefined) {
    cacheSet(key, result.data, ttl);
  }
  return result;
}
