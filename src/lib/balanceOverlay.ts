// Reconciles a (possibly stale) balance snapshot with claims this device knows about.
//
// The snapshot is recomputed every ~15s, so right after a claim it can still show
// the old `available`. Instead of guessing with timers, we ask for each known claim:
// "what state was this claim in at snapshot.asOf?" (from its createdAt/updatedAt)
// and apply only the difference between that and the claim's current state.
// Once the snapshot catches up the difference is zero, so numbers never jump back.

import type { BalanceItem, Claim, ClaimStatus } from '../api/types';
import { fromUnits, toUnits } from './amount';

type KnownState = 'absent' | ClaimStatus;

function stateAt(claim: Claim, asOfMs: number): KnownState {
  if (asOfMs < Date.parse(claim.createdAt)) return 'absent';
  if (claim.status === 'pending' || asOfMs < Date.parse(claim.updatedAt)) return 'pending';
  return claim.status;
}

/** Effect of a claim in a given state on [available, claiming]. */
function effect(state: KnownState, amount: bigint): [bigint, bigint] {
  switch (state) {
    case 'absent':
    case 'failed':
      return [0n, 0n];
    case 'pending':
      return [-amount, amount];
    case 'completed':
      return [-amount, 0n];
  }
}

export type AdjustedBalance = BalanceItem & {
  /** True when local claims changed the numbers the server sent. */
  adjusted: boolean;
};

export function applyClaimOverlay(items: BalanceItem[], asOf: string, claims: Claim[]): AdjustedBalance[] {
  const asOfMs = Date.parse(asOf);
  return items.map((item) => {
    let available = toUnits(item.available, item.decimals);
    let claiming = toUnits(item.claiming, item.decimals);
    let adjusted = false;
    for (const c of claims) {
      if (c.asset !== item.asset) continue;
      const amount = toUnits(c.amount, item.decimals);
      const [a0, c0] = effect(stateAt(c, asOfMs), amount);
      const [a1, c1] = effect(c.status, amount);
      if (a1 !== a0 || c1 !== c0) adjusted = true;
      available += a1 - a0;
      claiming += c1 - c0;
    }
    // Never show negative numbers if our view and the server's disagree.
    if (available < 0n) available = 0n;
    if (claiming < 0n) claiming = 0n;
    return {
      ...item,
      available: fromUnits(available, item.decimals),
      claiming: fromUnits(claiming, item.decimals),
      adjusted,
    };
  });
}

/** A known claim is no longer needed once it is settled and the snapshot reflects that. */
export function isReflected(claim: Claim, asOf: string): boolean {
  return claim.status !== 'pending' && stateAt(claim, Date.parse(asOf)) === claim.status;
}
