import { describe, expect, it } from 'vitest';
import type { BalanceItem, Claim } from '../api/types';
import { applyClaimOverlay, isReflected } from './balanceOverlay';

const item: BalanceItem = {
  asset: 'USDT', decimals: 6, available: '100', pending: '5', claiming: '0', usdPrice: '1',
};

const claim = (over: Partial<Claim>): Claim => ({
  id: 'clm_1', asset: 'USDT', amount: '40', fee: '1', receiveAmount: '39', destinationId: 'd',
  status: 'pending', failureReason: null,
  createdAt: '2026-10-21T10:00:00.000Z', updatedAt: '2026-10-21T10:00:00.000Z', ...over,
});

const BEFORE = '2026-10-21T09:59:50.000Z';
const AFTER_CREATE = '2026-10-21T10:00:05.000Z';
const AFTER_SETTLE = '2026-10-21T10:00:30.000Z';

describe('applyClaimOverlay', () => {
  it('moves a new pending claim from available to claiming when the snapshot predates it', () => {
    const [b] = applyClaimOverlay([item], BEFORE, [claim({})]);
    expect(b).toMatchObject({ available: '60', claiming: '40', adjusted: true });
  });

  it('does not double-count once the snapshot includes the claim', () => {
    const server = { ...item, available: '60', claiming: '40' };
    const [b] = applyClaimOverlay([server], AFTER_CREATE, [claim({})]);
    expect(b).toMatchObject({ available: '60', claiming: '40', adjusted: false });
  });

  it('returns funds for a failed claim the snapshot still shows as claiming', () => {
    const server = { ...item, available: '60', claiming: '40' };
    const failed = claim({ status: 'failed', updatedAt: '2026-10-21T10:00:20.000Z' });
    const [b] = applyClaimOverlay([server], AFTER_CREATE, [failed]);
    expect(b).toMatchObject({ available: '100', claiming: '0' });
  });

  it('a claim that failed before any snapshot saw it changes nothing', () => {
    const failed = claim({ status: 'failed', updatedAt: '2026-10-21T10:00:20.000Z' });
    const [b] = applyClaimOverlay([item], BEFORE, [failed]);
    expect(b).toMatchObject({ available: '100', claiming: '0', adjusted: false });
  });

  it('clears claiming for a completed claim the snapshot still shows as pending', () => {
    const server = { ...item, available: '60', claiming: '40' };
    const done = claim({ status: 'completed', updatedAt: '2026-10-21T10:00:20.000Z' });
    const [b] = applyClaimOverlay([server], AFTER_CREATE, [done]);
    expect(b).toMatchObject({ available: '60', claiming: '0' });
    expect(isReflected(done, AFTER_CREATE)).toBe(false);
    expect(isReflected(done, AFTER_SETTLE)).toBe(true);
  });

  it('ignores other assets', () => {
    const [b] = applyClaimOverlay([item], BEFORE, [claim({ asset: 'BTC' })]);
    expect(b).toMatchObject({ available: '100', adjusted: false });
  });
});
