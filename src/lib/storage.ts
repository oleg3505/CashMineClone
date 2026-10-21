// Thin localStorage wrapper. Storage can be missing or throw (private mode,
// blocked site data), so every access is guarded and falls back to memory.

const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getItem(key: string): string | null {
  try {
    const s = ls();
    if (s) return s.getItem(key);
  } catch {}
  return memory.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  memory.set(key, value);
  try {
    ls()?.setItem(key, value);
  } catch {}
}

export function removeItem(key: string): void {
  memory.delete(key);
  try {
    ls()?.removeItem(key);
  } catch {}
}

export function getJson<T>(key: string): T | null {
  const raw = getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJson(key: string, value: unknown): void {
  setItem(key, JSON.stringify(value));
}
