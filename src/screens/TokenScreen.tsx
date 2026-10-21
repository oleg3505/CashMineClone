import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../api/client';
import { Banner, Button } from '../ui/components';
import { s } from '../ui/theme';

export function TokenScreen({ onSave, reason, onCancel }: { onSave: (t: string) => void; reason?: string; onCancel?: () => void }) {
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const t = value.trim();
    if (!t) return;
    setChecking(true);
    setError(null);
    try {
      await api.checkToken(t);
      onSave(t);
    } catch (err) {
      const e = err as ApiError;
      setError(e.kind === 'unauthorized' ? 'This token is invalid or expired.' : `Couldn't check the token: ${e.message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[s.content, { flex: 1, justifyContent: 'center' }]}>
      <Text style={s.h1}>CashMine Payback</Text>
      <Text style={s.muted}>Paste your API token. It is stored only in this browser.</Text>
      {reason && <Banner tone="warn">{reason}</Banner>}
      <TextInput
        style={[s.input, { fontSize: 14 }]}
        value={value}
        onChangeText={setValue}
        placeholder="ct1.…"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        onSubmitEditing={save}
      />
      {error && <Banner tone="error">{error}</Banner>}
      <Button title="Continue" onPress={save} loading={checking} disabled={!value.trim()} />
      {onCancel && <Button title="Cancel" variant="secondary" onPress={onCancel} />}
    </View>
  );
}
