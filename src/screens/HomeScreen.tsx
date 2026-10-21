import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { formatAmount, formatUsd, toUnits, usdMicros } from '../lib/amount';
import { applyClaimOverlay, type AdjustedBalance } from '../lib/balanceOverlay';
import { useBalances } from '../state/balancesStore';
import { claims, useClaims } from '../state/claimsStore';
import { Banner, Button, Centered, ErrorState } from '../ui/components';
import { colors, s } from '../ui/theme';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ago(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  return min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
}

export function HomeScreen({
  onClaim, onOpenClaim, onOpenSubmission,
}: {
  onClaim: (asset: string) => void;
  onOpenClaim: (id: string) => void;
  onOpenSubmission: () => void;
}) {
  const { data, loading, error, refresh } = useBalances();
  const { known, submission, failedNotices } = useClaims();
  const now = useNow();

  const rows = useMemo(() => (data ? applyClaimOverlay(data.items, data.asOf, known) : []), [data, known]);

  const totals = useMemo(() => {
    let total = 0n;
    let available = 0n;
    for (const r of rows) {
      const units = (v: string) => toUnits(v, r.decimals);
      const all = units(r.available) + units(r.pending) + units(r.claiming);
      total += usdMicros(all, r.decimals, r.usdPrice);
      available += usdMicros(units(r.available), r.decimals, r.usdPrice);
    }
    return { total, available };
  }, [rows]);

  if (!data && error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.muted}>Loading balances…</Text>
      </Centered>
    );
  }

  const age = now - Date.parse(data.asOf);
  const stale = age > 60_000;
  const activeClaims = known.filter((c) => c.status === 'pending');

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.muted}>Total payback</Text>
        <Text style={s.big}>{formatUsd(totals.total)}</Text>
        <Text style={s.muted}>Available to claim now: {formatUsd(totals.available)}</Text>
        <View style={[s.row, { marginTop: 6 }]}>
          <Text style={[s.muted, stale && { color: colors.warn }]}>
            {stale ? '⚠ ' : ''}Updated {ago(age)}
          </Text>
          <Pressable accessibilityRole="button" onPress={refresh} disabled={loading} hitSlop={10}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '600' }}>↻ Refresh</Text>}
          </Pressable>
        </View>
      </View>

      {error && <Banner tone="warn">{`Couldn't refresh (${error}). Showing data from ${ago(age)}.`}</Banner>}

      {submission && submission.phase !== 'rejected' && (
        <Pressable onPress={onOpenSubmission}>
          <Banner tone="warn">
            {submission.phase === 'sending'
              ? `Submitting your claim of ${submission.body.amount} ${submission.body.asset}…`
              : `We couldn't confirm your claim of ${submission.body.amount} ${submission.body.asset}. Tap to check.`}
          </Banner>
        </Pressable>
      )}

      {failedNotices.map((c) => (
        <Banner key={c.id} tone="error">
          <Text style={{ color: colors.danger }}>
            {`Your claim of ${c.amount} ${c.asset} failed${c.failureReason ? `: ${c.failureReason}` : '.'} ${c.amount} ${c.asset} is back in your available balance.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => onOpenClaim(c.id)} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Details</Text>
            </Pressable>
            <Pressable onPress={() => claims.dismissFailed(c.id)} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Dismiss</Text>
            </Pressable>
          </View>
        </Banner>
      ))}

      {activeClaims.map((c) => (
        <Pressable key={c.id} onPress={() => onOpenClaim(c.id)}>
          <Banner tone="info">{`⏳ Claim of ${c.amount} ${c.asset} is processing. Tap to follow.`}</Banner>
        </Pressable>
      ))}

      {rows.length === 0 && <Text style={s.muted}>No balances yet.</Text>}
      {rows.map((r) => (
        <AssetCard key={r.asset} row={r} onClaim={() => onClaim(r.asset)} />
      ))}
    </ScrollView>
  );
}

function AssetCard({ row, onClaim }: { row: AdjustedBalance; onClaim: () => void }) {
  const u = (v: string) => toUnits(v, row.decimals);
  const available = u(row.available);
  const claiming = u(row.claiming);
  const pending = u(row.pending);
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.h2}>{row.asset}</Text>
        <Text style={s.muted}>{formatUsd(usdMicros(available, row.decimals, row.usdPrice))}</Text>
      </View>
      <Text style={[s.body, { fontSize: 22, fontWeight: '700' }]}>
        {formatAmount(available, row.decimals)} <Text style={s.muted}>available</Text>
      </Text>
      {pending > 0n && <Text style={s.muted}>Pending confirmation: {formatAmount(pending, row.decimals)}</Text>}
      {claiming > 0n && (
        <Text style={s.muted}>
          Being claimed: {formatAmount(claiming, row.decimals)}
          {row.adjusted ? ' (just submitted)' : ''}
        </Text>
      )}
      <View style={{ marginTop: 6 }}>
        <Button title={`Claim ${row.asset}`} onPress={onClaim} disabled={available <= 0n} variant="secondary" />
      </View>
    </View>
  );
}
