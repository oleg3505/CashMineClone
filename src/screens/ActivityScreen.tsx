import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { api, ApiError, withRetry } from '../api/client';
import type { ActivityItem } from '../api/types';
import { Banner, Button, Centered, ErrorState, RefreshButton } from '../ui/components';
import { colors, s } from '../ui/theme';

export function ActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    if (reset) setRefreshing(true);
    setError(null);
    try {
      const page = await withRetry(() => api.activity(reset ? null : cursor));
      setItems((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((i) => i.id));
        return [...base, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
      setDone(page.nextCursor === null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [cursor]);

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0 && error) return <ErrorState message={error} onRetry={() => load(true)} />;
  if (items.length === 0 && loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </Centered>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={s.content}
      onEndReached={() => { if (!done && !error) void load(false); }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={s.row}>
          <Text style={s.muted}>Newest first</Text>
          <RefreshButton onRefresh={() => load(true)} />
        </View>
      }
      ListEmptyComponent={<Text style={s.muted}>No activity yet.</Text>}
      renderItem={({ item }) => <Row item={item} />}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      ListFooterComponent={
        error ? (
          <Banner tone="error">
            <Text style={{ color: colors.danger }}>Couldn't load more: {error}</Text>
            <Button title="Try again" variant="secondary" onPress={() => load(false)} />
          </Banner>
        ) : loading && !refreshing ? (
          <ActivityIndicator color={colors.primary} />
        ) : done && items.length > 0 ? (
          <Text style={[s.muted, { textAlign: 'center' }]}>That's everything.</Text>
        ) : undefined
      }
    />
  );
}

const TYPE_LABEL = { accrual: 'Payback', reversal: 'Reversal', claim: 'Claim' } as const;

function Row({ item }: { item: ActivityItem }) {
  const negative = item.amount.startsWith('-');
  const statusColor = item.status === 'failed' ? colors.danger : item.status === 'pending' ? colors.warn : colors.muted;
  return (
    <View style={[s.card, { gap: 2 }]}>
      <View style={s.row}>
        <Text style={s.h2}>
          {TYPE_LABEL[item.type]}
          {item.exchange ? ` · ${item.exchange}` : ''}
        </Text>
        <Text style={{ fontWeight: '700', color: negative ? colors.text : colors.success }}>
          {negative ? '' : '+'}
          {item.amount} {item.asset}
        </Text>
      </View>
      <View style={s.row}>
        <Text style={s.muted}>{new Date(item.createdAt).toLocaleString()}</Text>
        <Text style={{ fontSize: 13, color: statusColor }}>{item.status}</Text>
      </View>
    </View>
  );
}
