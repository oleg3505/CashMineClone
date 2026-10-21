import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, ApiError, withRetry } from '../api/client';
import type { ClaimOptions } from '../api/types';
import { formatAmount, fromUnits, toUnits, validateClaimAmount } from '../lib/amount';
import { applyClaimOverlay } from '../lib/balanceOverlay';
import { useBalances } from '../state/balancesStore';
import { claims, useClaims } from '../state/claimsStore';
import { Banner, Button, Centered, ErrorState, KV } from '../ui/components';
import { colors, s } from '../ui/theme';

export function ClaimScreen({ initialAsset, onCreated }: { initialAsset?: string; onCreated: (id: string) => void }) {
  const { data, error: balError, refresh } = useBalances();
  const { known, submission, lastCreatedId } = useClaims();
  const [asset, setAsset] = useState<string | undefined>(initialAsset ?? submission?.body.asset);
  const [options, setOptions] = useState<ClaimOptions | null>(null);
  const [optError, setOptError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [destinationId, setDestinationId] = useState<string | null>(null);

  const rows = useMemo(() => (data ? applyClaimOverlay(data.items, data.asOf, known) : []), [data, known]);
  const row = rows.find((r) => r.asset === asset) ?? null;

  useEffect(() => {
    if (!asset && rows.length) setAsset(rows[0].asset);
  }, [asset, rows]);

  const loadOptions = () => {
    if (!asset) return;
    setOptions(null);
    setOptError(null);
    withRetry(() => api.claimOptions(asset))
      .then((o) => {
        setOptions(o);
        setDestinationId(o.destinations[0]?.id ?? null);
      })
      .catch((e: ApiError) => setOptError(e.message));
  };
  useEffect(loadOptions, [asset]);

  useEffect(() => {
    if (lastCreatedId) {
      claims.consumeCreated();
      onCreated(lastCreatedId);
    }
  }, [lastCreatedId, onCreated]);

  const validation = useMemo(() => {
    if (!row || !options) return null;
    return validateClaimAmount(input, {
      decimals: row.decimals,
      minAmount: toUnits(options.minAmount, row.decimals),
      fee: toUnits(options.fee, row.decimals),
      available: toUnits(row.available, row.decimals),
    });
  }, [input, row, options]);

  // An unresolved submission takes over the screen: no new claim until it resolves.
  if (submission && submission.phase !== 'rejected') {
    return <SubmissionView />;
  }

  if (!data && balError) return <ErrorState message={balError} onRetry={refresh} />;
  if (optError) return <ErrorState message={optError} onRetry={loadOptions} />;
  if (!row || !options) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </Centered>
    );
  }

  const d = row.decimals;
  const available = toUnits(row.available, d);
  const fee = toUnits(options.fee, d);
  const ok = validation?.ok === true;
  const destination = options.destinations.find((x) => x.id === destinationId);

  const submit = () => {
    if (!validation?.ok || !destinationId) return;
    claims.submit({ asset: row.asset, amount: fromUnits(validation.amount, d), destinationId });
  };

  if (reviewing && validation?.ok) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.h2}>Review your claim</Text>
        <View style={s.card}>
          <KV k="Amount" v={`${formatAmount(validation.amount, d)} ${row.asset}`} />
          <KV k="Fee" v={`− ${formatAmount(validation.fee, d)} ${row.asset}`} />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <KV k="You receive" v={`${formatAmount(validation.receive, d)} ${row.asset}`} strong />
          <KV k="To" v={destination?.label ?? '—'} />
        </View>
        {submission?.phase === 'rejected' && <Banner tone="error">{submission.error ?? 'Claim was rejected'}</Banner>}
        <Button title="Confirm and claim" onPress={submit} />
        <Button title="Edit" variant="secondary" onPress={() => { claims.dismissRejected(); setReviewing(false); }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>Asset</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {rows.map((r) => (
          <Pressable
            key={r.asset}
            onPress={() => { setAsset(r.asset); setInput(''); setTouched(false); claims.dismissRejected(); }}
            style={{
              paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
              borderColor: r.asset === asset ? colors.primary : colors.border,
              backgroundColor: r.asset === asset ? colors.primary : colors.card,
            }}
          >
            <Text style={{ color: r.asset === asset ? colors.primaryText : colors.text, fontWeight: '600' }}>{r.asset}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.row}>
        <Text style={s.muted}>Amount</Text>
        <Text style={s.muted}>Available: {formatAmount(available, d)} {row.asset}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={input}
          onChangeText={(t) => { setInput(t); setTouched(true); }}
          placeholder="0.00"
          inputMode="decimal"
          keyboardType="decimal-pad"
          autoCorrect={false}
        />
        <Button title="Max" variant="secondary" onPress={() => { setInput(fromUnits(available, d)); setTouched(true); }} />
      </View>
      {touched && validation && !validation.ok && <Text style={{ color: colors.danger }}>{validation.message}</Text>}

      <View style={s.card}>
        <KV k="Minimum" v={`${options.minAmount} ${row.asset}`} />
        <KV k="Fee" v={`${formatAmount(fee, d)} ${row.asset}`} />
        <KV k="You receive" v={validation?.ok ? `${formatAmount(validation.receive, d)} ${row.asset}` : '—'} strong />
      </View>

      {options.destinations.length > 1 && (
        <View style={{ gap: 8 }}>
          <Text style={s.muted}>Send to</Text>
          {options.destinations.map((dst) => (
            <Pressable key={dst.id} onPress={() => setDestinationId(dst.id)}>
              <Text style={[s.body, dst.id === destinationId && { fontWeight: '700', color: colors.primary }]}>
                {dst.id === destinationId ? '● ' : '○ '}
                {dst.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {options.destinations.length === 1 && <Text style={s.muted}>Send to: {destination?.label}</Text>}
      {options.destinations.length === 0 && <Banner tone="error">No destination is available for this asset.</Banner>}

      <Button title="Review" onPress={() => { setTouched(true); if (ok) setReviewing(true); }} disabled={!ok || !destinationId} />
    </ScrollView>
  );
}

function SubmissionView() {
  const { submission } = useClaims();
  if (!submission) return null;
  const { body } = submission;
  if (submission.phase === 'sending') {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.h2}>Submitting claim…</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>
          {body.amount} {body.asset}
          {submission.attempt > 1 ? `\nNo answer yet, checking again (attempt ${submission.attempt})…` : ''}
        </Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>Keep this page open. Retries can't create a duplicate claim.</Text>
      </Centered>
    );
  }
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Banner tone="warn">
        <Text style={[s.h2, { color: colors.warn }]}>We couldn't confirm your claim</Text>
        <Text style={{ color: colors.warn }}>
          Your claim of {body.amount} {body.asset} may or may not have been created; the server didn't answer
          {submission.error ? ` (${submission.error})` : ''}.
        </Text>
        <Text style={{ color: colors.warn }}>
          Don't start a new claim. Tap "Check again": it resends the same request, and the server will never
          create it twice.
        </Text>
      </Banner>
      <Button title="Check again" onPress={claims.retry} />
    </ScrollView>
  );
}
