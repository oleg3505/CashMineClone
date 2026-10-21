import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setApiToken, setUnauthorizedHandler } from './src/api/client';
import { getItem, removeItem, setItem } from './src/lib/storage';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ClaimScreen } from './src/screens/ClaimScreen';
import { ClaimStatusScreen } from './src/screens/ClaimStatusScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { TokenScreen } from './src/screens/TokenScreen';
import { refreshBalances, resetBalances } from './src/state/balancesStore';
import { resumeClaims } from './src/state/claimsStore';
import { Header } from './src/ui/components';
import { colors, s } from './src/ui/theme';

const TOKEN_KEY = 'cm.token';

type Route =
  | { name: 'home' }
  | { name: 'activity' }
  | { name: 'claim'; asset?: string }
  | { name: 'claimStatus'; id: string }
  | { name: 'token' };

export default function App() {
  const [token, setToken] = useState<string | null>(() => getItem(TOKEN_KEY));
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [tokenReason, setTokenReason] = useState<string | undefined>();

  useEffect(() => {
    setApiToken(token);
    if (token) resumeClaims(token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      removeItem(TOKEN_KEY);
      setToken(null);
      setTokenReason('Your token is invalid or has expired. Please enter a new one.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const saveToken = (t: string) => {
    setItem(TOKEN_KEY, t);
    setApiToken(t);
    resetBalances();
    setToken(t);
    setTokenReason(undefined);
    setRoute({ name: 'home' });
    void refreshBalances();
  };

  const goHome = useCallback(() => setRoute({ name: 'home' }), []);
  const openClaim = useCallback((id: string) => setRoute({ name: 'claimStatus', id }), []);

  let body: React.ReactNode;
  if (!token || route.name === 'token') {
    body = <TokenScreen onSave={saveToken} reason={tokenReason} onCancel={token ? goHome : undefined} />;
  } else {
    const tabs = route.name === 'home' || route.name === 'activity';
    body = (
      <View style={{ flex: 1 }}>
        {route.name === 'home' && (
          <>
            <Header
              title="Payback"
              right={
                <Pressable onPress={() => setRoute({ name: 'token' })} hitSlop={10}>
                  <Text style={{ color: colors.primary }}>Change token</Text>
                </Pressable>
              }
            />
            <HomeScreen
              onClaim={(asset) => setRoute({ name: 'claim', asset })}
              onOpenClaim={openClaim}
              onOpenSubmission={() => setRoute({ name: 'claim' })}
            />
          </>
        )}
        {route.name === 'activity' && (
          <>
            <Header title="Activity" />
            <ActivityScreen />
          </>
        )}
        {route.name === 'claim' && (
          <>
            <Header title="Claim payback" onBack={goHome} />
            <ClaimScreen initialAsset={route.asset} onCreated={openClaim} />
          </>
        )}
        {route.name === 'claimStatus' && (
          <>
            <Header title="Claim status" onBack={goHome} />
            <ClaimStatusScreen id={route.id} onDone={goHome} />
          </>
        )}
        {tabs && (
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
            <Tab label="Balances" active={route.name === 'home'} onPress={goHome} />
            <Tab label="Activity" active={route.name === 'activity'} onPress={() => setRoute({ name: 'activity' })} />
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.screen, { alignItems: 'center' }]}>
        {/* Phone-width column, also on desktop browsers */}
        <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>{body}</View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
      <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}
