// Claim submission and tracking.
//
// Submission rule: one Idempotency-Key per user intent. The key and body are
// persisted *before* the first request, and every retry reuses them, so a lost
// response can never create a second claim. When the outcome is unknown
// (timeout, 5xx, network), we retry automatically with the same key; if that
// still fails, the user can only retry with the same key, not start a new claim.

import { useSyncExternalStore } from 'react';
import { api, ApiError, sleep } from '../api/client';
import type { Claim, CreateClaimBody } from '../api/types';
import { isReflected } from '../lib/balanceOverlay';
import { getJson, setJson } from '../lib/storage';

export type Submission = {
  key: string;
  body: CreateClaimBody;
  startedAt: string;
  /** sending: in flight; unknown: retries exhausted, outcome unknown; rejected: server said no */
  phase: 'sending' | 'unknown' | 'rejected';
  attempt: number;
  error: string | null;
};

type State = {
  known: Claim[];
  submission: Submission | null;
  /** Set when a submission produced a claim; the UI navigates to it. */
  lastCreatedId: string | null;
  /** Failed claims the user has not dismissed yet, so a returned amount is never unexplained. */
  failedNotices: Claim[];
};

const KNOWN_KEY = 'cm.knownClaims';
const FAILED_KEY = 'cm.failedNotices';
const SUBMISSION_KEY = 'cm.pendingSubmission';
const MAX_AUTO_ATTEMPTS = 5;
const POLL_MS = 2000;

let state: State = {
  known: getJson<Claim[]>(KNOWN_KEY) ?? [],
  submission: restoreSubmission(),
  lastCreatedId: null,
  failedNotices: getJson<Claim[]>(FAILED_KEY) ?? [],
};
const listeners = new Set<() => void>();

function restoreSubmission(): Submission | null {
  const s = getJson<Submission>(SUBMISSION_KEY);
  // A submission found on start was interrupted mid-flight: its outcome is unknown.
  return s ? { ...s, phase: 'unknown' } : null;
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  setJson(KNOWN_KEY, state.known);
  setJson(FAILED_KEY, state.failedNotices);
  if (state.submission && state.submission.phase !== 'rejected') setJson(SUBMISSION_KEY, state.submission);
  else setJson(SUBMISSION_KEY, null);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useClaims(): State {
  return useSyncExternalStore(subscribe, () => state);
}

function upsertClaim(claim: Claim) {
  const others = state.known.filter((c) => c.id !== claim.id);
  const prev = state.known.find((c) => c.id === claim.id);
  const newlyFailed = claim.status === 'failed' && prev?.status !== 'failed';
  set({
    known: [claim, ...others],
    ...(newlyFailed && { failedNotices: [claim, ...state.failedNotices.filter((c) => c.id !== claim.id)] }),
  });
}

function newKey(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let running = false;

async function runSubmission(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let attempt = 1; state.submission; attempt++) {
      const sub: Submission = state.submission;
      set({ submission: { ...sub, phase: 'sending', attempt, error: null } });
      try {
        const claim = await api.createClaim(sub.body, sub.key);
        upsertClaim(claim);
        set({ submission: null, lastCreatedId: claim.id });
        trackClaim(claim.id);
        return;
      } catch (err) {
        const e = err instanceof ApiError ? err : new ApiError(String(err), 'unknown', null);
        if (e.kind === 'rejected' || e.kind === 'unauthorized') {
          // The server answered: no claim was created. Safe to let the user edit and try again.
          set({ submission: { ...sub, phase: 'rejected', attempt, error: e.message } });
          return;
        }
        if (e.kind === 'rate_limited') {
          await sleep(e.retryAfterMs ?? 2000);
          attempt--; // a 429 is a definite "not processed", it does not use up an attempt
          continue;
        }
        if (attempt >= MAX_AUTO_ATTEMPTS) {
          set({ submission: { ...sub, phase: 'unknown', attempt, error: e.message } });
          return;
        }
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
      }
    }
  } finally {
    running = false;
  }
}

export const claims = {
  /** Starts a new claim. Refuses while another submission is unresolved. */
  submit(body: CreateClaimBody): boolean {
    if (state.submission && state.submission.phase !== 'rejected') return false;
    set({
      submission: { key: newKey(), body, startedAt: new Date().toISOString(), phase: 'sending', attempt: 0, error: null },
      lastCreatedId: null,
    });
    void runSubmission();
    return true;
  },

  /** Retries an unknown-outcome submission with the SAME key and body. */
  retry() {
    if (state.submission?.phase === 'unknown') void runSubmission();
  },

  /** Drops a rejected submission so the user can edit the form. */
  dismissRejected() {
    if (state.submission?.phase === 'rejected') set({ submission: null });
  },

  dismissFailed(id: string) {
    set({ failedNotices: state.failedNotices.filter((c) => c.id !== id) });
  },

  consumeCreated() {
    set({ lastCreatedId: null });
  },

  /** Removes claims the server snapshot fully reflects, so the overlay stays small. */
  prune(asOf: string) {
    const known = state.known.filter((c) => !isReflected(c, asOf));
    if (known.length !== state.known.length) set({ known });
  },
};

const tracking = new Set<string>();

/** Polls a claim until it settles. Transient errors are retried; the loop is idempotent per id. */
export async function trackClaim(id: string): Promise<void> {
  if (tracking.has(id)) return;
  tracking.add(id);
  try {
    for (;;) {
      try {
        const claim = await api.claim(id);
        upsertClaim(claim);
        if (claim.status !== 'pending') return;
        await sleep(POLL_MS);
      } catch (err) {
        const e = err as ApiError;
        if (e instanceof ApiError && (e.kind === 'rejected' || e.kind === 'unauthorized')) return;
        await sleep(e instanceof ApiError && e.kind === 'rate_limited' ? (e.retryAfterMs ?? 2000) : POLL_MS * 2);
      }
    }
  } finally {
    tracking.delete(id);
  }
}

const OWNER_KEY = 'cm.claimsOwner';

/**
 * Resume work left over from a previous session (page reload mid-claim).
 * Persisted claims belong to one token; switching tokens starts clean so one
 * account's claims are never overlaid on another account's balances.
 */
export function resumeClaims(token: string) {
  const owner = token.slice(-16);
  if (getJson<string>(OWNER_KEY) !== owner) {
    tracking.clear();
    set({ known: [], submission: null, lastCreatedId: null, failedNotices: [] });
    setJson(OWNER_KEY, owner);
    return;
  }
  state.known.filter((c) => c.status === 'pending').forEach((c) => void trackClaim(c.id));
  if (state.submission?.phase === 'unknown') void runSubmission();
}
