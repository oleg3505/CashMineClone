import { API_BASE_URL } from '../config';
import type { ActivityPage, Balances, Claim, ClaimOptions, CreateClaimBody } from './types';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * `kind` tells callers what they can conclude:
 * - 'rejected': the server answered and definitely did not do the thing (4xx)
 * - 'unknown':  we cannot tell whether the server acted (timeout, 5xx, network)
 * - 'rate_limited': rejected, safe to retry after `retryAfterMs`
 * - 'unauthorized': token missing, invalid or expired
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public kind: 'rejected' | 'unknown' | 'rate_limited' | 'unauthorized',
    public status: number | null,
    public code: string | null = null,
    public field: string | null = null,
    public retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(t: string | null) {
  token = t;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}, authToken = token): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${authToken ?? ''}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Network error or timeout', 'unknown', null);
  } finally {
    clearTimeout(timer);
  }

  if (res.ok) return (await res.json()) as T;

  let body: { error?: { code?: string; message?: string; field?: string; retryAfterMs?: number } } = {};
  try {
    body = await res.json();
  } catch {}
  const e = body.error ?? {};
  const message = e.message ?? `Request failed (${res.status})`;

  if (res.status === 401) {
    if (authToken === token) onUnauthorized?.();
    throw new ApiError(message, 'unauthorized', 401, e.code ?? null);
  }
  if (res.status === 429) {
    const header = Number(res.headers.get('Retry-After'));
    const retryAfterMs = e.retryAfterMs ?? (Number.isFinite(header) && header > 0 ? header * 1000 : 2000);
    throw new ApiError(message, 'rate_limited', 429, e.code ?? null, null, retryAfterMs);
  }
  if (res.status >= 500) throw new ApiError(message, 'unknown', res.status, e.code ?? null);
  throw new ApiError(message, 'rejected', res.status, e.code ?? null, e.field ?? null);
}

export const api = {
  /** Used by the token screen to check a token before saving it. */
  checkToken: (t: string) => request<Balances>('/v1/balances', {}, t),
  balances: () => request<Balances>('/v1/balances'),
  activity: (cursor?: string | null) =>
    request<ActivityPage>(`/v1/activity?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
  claimOptions: (asset: string) => request<ClaimOptions>(`/v1/claim-options?asset=${encodeURIComponent(asset)}`),
  createClaim: (body: CreateClaimBody, idempotencyKey: string) =>
    request<Claim>('/v1/claims', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  claim: (id: string) => request<Claim>(`/v1/claims/${encodeURIComponent(id)}`),
};

/** Retries reads on transient errors and 429s. Never used for POST /claims (see claims store). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as ApiError;
      const retryable = e instanceof ApiError && (e.kind === 'unknown' || e.kind === 'rate_limited');
      if (!retryable || i >= attempts - 1) throw err;
      await sleep(e.kind === 'rate_limited' ? (e.retryAfterMs ?? 2000) : 500 * 2 ** i);
    }
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
