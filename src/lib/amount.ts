// Money math. Amounts are held as bigint counts of the asset's smallest unit
// (10^-decimals), never as JS numbers, so there is no float rounding anywhere.

export type Units = bigint;

const API_AMOUNT_RE = /^(0|[1-9]\d*)(\.\d+)?$/;

/** Parses a strict API decimal string ("0.5", "12") into units. Throws on bad input. */
export function toUnits(value: string, decimals: number): Units {
  if (!API_AMOUNT_RE.test(value)) throw new Error(`Invalid amount "${value}"`);
  const [whole, frac = ''] = value.split('.');
  if (frac.length > decimals) {
    // The API never sends more places than `decimals`, but tolerate trailing zeros.
    if (/[^0]/.test(frac.slice(decimals))) throw new Error(`Too many decimals in "${value}"`);
  }
  return BigInt(whole + frac.slice(0, decimals).padEnd(decimals, '0'));
}

/** Formats units as an API-valid decimal string: no leading zeros, no trailing fraction zeros. */
export function fromUnits(units: Units, decimals: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const frac = decimals > 0 ? digits.slice(digits.length - decimals).replace(/0+$/, '') : '';
  return (negative ? '-' : '') + whole + (frac ? `.${frac}` : '');
}

export type ParseError = 'empty' | 'format' | 'decimals';
export type ParseResult = { ok: true; units: Units } | { ok: false; error: ParseError };

/**
 * Parses what the user typed. More forgiving than the API format: accepts a comma
 * as the decimal separator, ".5" and "5." and leading zeros, then normalises.
 */
export function parseUserAmount(input: string, decimals: number): ParseResult {
  let s = input.trim().replace(',', '.');
  if (s === '') return { ok: false, error: 'empty' };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { ok: false, error: 'format' };
  if (s.startsWith('.')) s = `0${s}`;
  if (s.endsWith('.')) s = s.slice(0, -1);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) return { ok: false, error: 'decimals' };
  return { ok: true, units: BigInt(whole + frac.padEnd(decimals, '0')) };
}

export type ClaimRules = {
  decimals: number;
  minAmount: Units;
  fee: Units;
  available: Units;
};

export type ClaimValidation =
  | { ok: true; amount: Units; fee: Units; receive: Units }
  | { ok: false; message: string };

export function validateClaimAmount(input: string, rules: ClaimRules): ClaimValidation {
  const parsed = parseUserAmount(input, rules.decimals);
  if (!parsed.ok) {
    const message = {
      empty: 'Enter an amount',
      format: 'Enter a number, e.g. 0.5',
      decimals: `At most ${rules.decimals} decimal places`,
    }[parsed.error];
    return { ok: false, message };
  }
  const amount = parsed.units;
  if (amount <= 0n) return { ok: false, message: 'Amount must be greater than 0' };
  if (amount < rules.minAmount) {
    return { ok: false, message: `Minimum is ${fromUnits(rules.minAmount, rules.decimals)}` };
  }
  if (amount > rules.available) {
    return { ok: false, message: `Only ${fromUnits(rules.available, rules.decimals)} available` };
  }
  const receive = amount - rules.fee;
  if (receive <= 0n) return { ok: false, message: 'Amount must be larger than the fee' };
  return { ok: true, amount, fee: rules.fee, receive };
}

// USD values are kept in micro-dollars (10^-6) and only rounded to cents for display,
// so summing many assets does not accumulate per-row rounding errors.
const USD_SCALE = 6;

function roundHalfUpDiv(n: bigint, d: bigint): bigint {
  return n >= 0n ? (n + d / 2n) / d : -((-n + d / 2n) / d);
}

/** Exact value of `units` at `usdPrice` (a decimal string), in micro-USD. */
export function usdMicros(units: Units, decimals: number, usdPrice: string): bigint {
  const priceDecimals = usdPrice.split('.')[1]?.length ?? 0;
  const price = toUnits(usdPrice, priceDecimals);
  const scale = decimals + priceDecimals;
  const product = units * price;
  if (scale <= USD_SCALE) return product * 10n ** BigInt(USD_SCALE - scale);
  return roundHalfUpDiv(product, 10n ** BigInt(scale - USD_SCALE));
}

/** Formats micro-USD as "$1,234.57" (half-up to cents). */
export function formatUsd(micros: bigint): string {
  const cents = roundHalfUpDiv(micros, 10n ** BigInt(USD_SCALE - 2));
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${whole}.${frac}`;
}

/** Display formatting for asset amounts: grouped thousands, trailing zeros trimmed. */
export function formatAmount(units: Units, decimals: number): string {
  const s = fromUnits(units, decimals);
  const [whole, frac] = s.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}
