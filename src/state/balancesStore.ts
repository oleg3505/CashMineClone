// Shared balance snapshot for Home and Claim screens, refreshed on demand and
// every 15s (the server's snapshot interval) while something is subscribed.

import { useEffect, useSyncExternalStore } from 'react';
import { api, ApiError, withRetry } from '../api/client';
import type { Balances } from '../api/types';
import { claims } from './claimsStore';

type State = {
  data: Balances | null;
  loading: boolean;
  error: string | null;
};

const REFRESH_MS = 15_000;

let state: State = { data: null, loading: false, error: null };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

let inFlight: Promise<void> | null = null;

export function refreshBalances(): Promise<void> {
  if (inFlight) return inFlight;
  set({ loading: true });
  inFlight = withRetry(() => api.balances())
    .then((data) => {
      // Ignore an out-of-order response older than what we already show.
      if (state.data && Date.parse(data.asOf) < Date.parse(state.data.asOf)) return set({ loading: false, error: null });
      set({ data, loading: false, error: null });
      claims.prune(data.asOf);
    })
    .catch((err) => {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong';
      set({ loading: false, error: msg });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function resetBalances() {
  set({ data: null, loading: false, error: null });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBalances(): State & { refresh: () => Promise<void> } {
  const s = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!state.data && !state.loading) void refreshBalances();
    const id = setInterval(() => void refreshBalances(), REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return { ...s, refresh: refreshBalances };
}
