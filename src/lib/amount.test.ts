import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatUsd,
  fromUnits,
  parseUserAmount,
  toUnits,
  usdMicros,
  validateClaimAmount,
} from './amount';

describe('toUnits / fromUnits', () => {
  it('round-trips API amounts', () => {
    expect(toUnits('820.413207', 6)).toBe(820413207n);
    expect(fromUnits(820413207n, 6)).toBe('820.413207');
    expect(toUnits('0.0005', 8)).toBe(50000n);
    expect(fromUnits(50000n, 8)).toBe('0.0005');
    expect(fromUnits(toUnits('12', 6), 6)).toBe('12');
    expect(fromUnits(0n, 6)).toBe('0');
  });

  it('formats negative values', () => {
    expect(fromUnits(-5n, 2)).toBe('-0.05');
  });

  it('rejects strings the API forbids', () => {
    for (const bad of ['.5', '1.', '05', '1e-3', '-1', '', 'abc']) {
      expect(() => toUnits(bad, 6)).toThrow();
    }
  });

  it('does not lose precision where floats would', () => {
    // 0.1 + 0.2 !== 0.3 in floats
    expect(fromUnits(toUnits('0.1', 18) + toUnits('0.2', 18), 18)).toBe('0.3');
  });
});

describe('parseUserAmount', () => {
  it('normalises forgiving user input', () => {
    expect(parseUserAmount('.5', 6)).toEqual({ ok: true, units: 500000n });
    expect(parseUserAmount('5.', 6)).toEqual({ ok: true, units: 5000000n });
    expect(parseUserAmount('0,25', 6)).toEqual({ ok: true, units: 250000n });
    expect(parseUserAmount(' 007 ', 2)).toEqual({ ok: true, units: 700n });
  });

  it('reports errors', () => {
    expect(parseUserAmount('', 6)).toEqual({ ok: false, error: 'empty' });
    expect(parseUserAmount('.', 6)).toEqual({ ok: false, error: 'format' });
    expect(parseUserAmount('1e3', 6)).toEqual({ ok: false, error: 'format' });
    expect(parseUserAmount('-1', 6)).toEqual({ ok: false, error: 'format' });
    expect(parseUserAmount('1.2.3', 6)).toEqual({ ok: false, error: 'format' });
    expect(parseUserAmount('0.1234567', 6)).toEqual({ ok: false, error: 'decimals' });
  });
});

describe('validateClaimAmount', () => {
  const rules = { decimals: 6, minAmount: toUnits('10', 6), fee: toUnits('1.5', 6), available: toUnits('100', 6) };

  it('accepts a valid amount and computes the receive amount', () => {
    const r = validateClaimAmount('50', rules);
    expect(r).toEqual({ ok: true, amount: 50000000n, fee: 1500000n, receive: 48500000n });
  });

  it('accepts exactly min and exactly available (inclusive bounds)', () => {
    expect(validateClaimAmount('10', rules).ok).toBe(true);
    expect(validateClaimAmount('100', rules).ok).toBe(true);
  });

  it('rejects below min, above available, zero and too many decimals', () => {
    expect(validateClaimAmount('9.999999', rules)).toEqual({ ok: false, message: 'Minimum is 10' });
    expect(validateClaimAmount('100.000001', rules)).toEqual({ ok: false, message: 'Only 100 available' });
    expect(validateClaimAmount('0', rules)).toEqual({ ok: false, message: 'Amount must be greater than 0' });
    expect(validateClaimAmount('1.0000001', rules)).toEqual({ ok: false, message: 'At most 6 decimal places' });
  });

  it('rejects amounts that would not cover the fee', () => {
    const r = validateClaimAmount('1.5', { ...rules, minAmount: 1n });
    expect(r).toEqual({ ok: false, message: 'Amount must be larger than the fee' });
  });
});

describe('USD totals', () => {
  it('computes exact values and rounds only for display', () => {
    // 820.413207 USDT * 1.0002 = 820.5772896414 -> $820.58
    const micros = usdMicros(toUnits('820.413207', 6), 6, '1.0002');
    expect(micros).toBe(820577290n);
    expect(formatUsd(micros)).toBe('$820.58');
  });

  it('sums before rounding', () => {
    // three rows of $0.004 each: per-row rounding gives $0.00, summing first gives $0.01
    const row = usdMicros(toUnits('0.004', 6), 6, '1');
    expect(formatUsd(row)).toBe('$0.00');
    expect(formatUsd(row * 3n)).toBe('$0.01');
  });

  it('handles integer prices and large numbers', () => {
    expect(formatUsd(usdMicros(toUnits('1.5', 8), 8, '65000'))).toBe('$97,500.00');
    expect(formatAmount(toUnits('1234567.5', 6), 6)).toBe('1,234,567.5');
  });
});
