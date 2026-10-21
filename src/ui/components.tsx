import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors, s } from './theme';

export function Button({
  title, onPress, disabled, variant = 'primary', loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}) {
  const primary = variant === 'primary';
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: primary ? colors.primary : colors.card,
        borderColor: primary ? colors.primary : colors.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        opacity: off ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.primaryText : colors.primary} />
      ) : (
        <Text style={{ color: primary ? colors.primaryText : colors.primary, fontWeight: '600', fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'warn' | 'success' | 'info'; children: React.ReactNode }) {
  const map = {
    error: [colors.dangerBg, colors.danger],
    warn: [colors.warnBg, colors.warn],
    success: [colors.successBg, colors.success],
    info: [colors.card, colors.text],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
      {typeof children === 'string' ? <Text style={{ color: fg, fontSize: 14 }}>{children}</Text> : children}
    </View>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>{children}</View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Centered>
      <Text style={[s.h2, { textAlign: 'center' }]}>Couldn't load</Text>
      <Text style={[s.muted, { textAlign: 'center' }]}>{message}</Text>
      <Button title="Try again" onPress={onRetry} />
    </Centered>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 8 }}>
      {onBack && (
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={{ fontSize: 16, color: colors.primary }}>‹ Back</Text>
        </Pressable>
      )}
      <Text style={[s.h1, { flex: 1 }]}>{title}</Text>
      {right}
    </View>
  );
}

export function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.muted}>{k}</Text>
      <Text style={[s.body, strong && { fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}
