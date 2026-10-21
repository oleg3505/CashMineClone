import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { api, ApiError } from '../api/client';
import type { Claim } from '../api/types';
import { trackClaim, useClaims } from '../state/claimsStore';
import { refreshBalances } from '../state/balancesStore';
import { Banner, Button, Centered, ErrorState, KV } from '../ui/components';
import { colors, s } from '../ui/theme';

export function ClaimStatusScreen({ id, onDone }: { id: string; onDone: () => void }) {
  const { known } = useClaims();
  const [fetched, setFetched] = useState<Claim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claim = known.find((c) => c.id === id) ?? fetched;

  const load = () => {
    setError(null);
    api.claim(id).then(setFetched).catch((e: ApiError) => setError(e.message));
  };

  useEffect(() => {
    void trackClaim(id);
    if (!known.some((c) => c.id === id)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pull a fresh snapshot once the claim settles so Home is up to date.
  useEffect(() => {
    if (claim && claim.status !== 'pending') void refreshBalances();
  }, [claim?.status]);

  if (!claim && error) return <ErrorState message={error} onRetry={load} />;
  if (!claim) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </Centered>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Step label="Submitted" state="done" />
        <Step label="Processing" state={claim.status === 'pending' ? 'active' : 'done'} />
        <Step
          label={claim.status === 'failed' ? 'Failed' : 'Completed'}
          state={claim.status === 'pending' ? 'todo' : claim.status === 'failed' ? 'failed' : 'done'}
        />
      </View>

      {claim.status === 'pending' && <Banner tone="info">Usually takes up to 20 seconds. You can leave this screen; we keep checking.</Banner>}
      {claim.status === 'completed' && <Banner tone="success">{`${claim.receiveAmount} ${claim.asset} is on its way to your wallet.`}</Banner>}
      {claim.status === 'failed' && (
        <Banner tone="error">
          {`This claim failed${claim.failureReason ? `: ${claim.failureReason}` : ''}. ${claim.amount} ${claim.asset} has been returned to your available balance.`}
        </Banner>
      )}

      <View style={s.card}>
        <KV k="Amount" v={`${claim.amount} ${claim.asset}`} />
        <KV k="Fee" v={`${claim.fee} ${claim.asset}`} />
        <KV k="You receive" v={`${claim.receiveAmount} ${claim.asset}`} strong />
        <KV k="Created" v={new Date(claim.createdAt).toLocaleString()} />
        <Text style={s.muted}>ID: {claim.id}</Text>
      </View>
      <Button title="Back to balances" variant="secondary" onPress={onDone} />
    </ScrollView>
  );
}

function Step({ label, state }: { label: string; state: 'done' | 'active' | 'todo' | 'failed' }) {
  const icon = { done: '✓', active: '', todo: '○', failed: '✕' }[state];
  const color = { done: colors.success, active: colors.primary, todo: colors.muted, failed: colors.danger }[state];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <View style={{ width: 20, alignItems: 'center' }}>
        {state === 'active' ? <ActivityIndicator size="small" color={color} /> : <Text style={{ color, fontWeight: '700' }}>{icon}</Text>}
      </View>
      <Text style={[s.body, { color: state === 'todo' ? colors.muted : colors.text }]}>{label}</Text>
    </View>
  );
}
