import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  primary: '#0F766E',
  primaryText: '#FFFFFF',
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
  warn: '#92400E',
  warnBg: '#FFFBEB',
  success: '#15803D',
  successBg: '#F0FDF4',
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 6 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 17, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  big: { fontSize: 30, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, color: colors.text,
  },
});
