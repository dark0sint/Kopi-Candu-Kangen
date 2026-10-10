import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { C } from './theme';

export const Button = ({ title, onPress, kind = 'primary', disabled, style }) => (
  <Pressable onPress={onPress} disabled={disabled}
    style={[s.btn, kind === 'ghost' && s.ghost, kind === 'danger' && s.danger, disabled && { opacity: 0.5 }, style]}>
    <Text style={[s.btnT, kind !== 'primary' && { color: kind === 'danger' ? '#B3261E' : C.roast }]}>{title}</Text>
  </Pressable>
);
export const Chip = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}><Text style={[s.chipT, on && { color: '#fff' }]}>{label}</Text></Pressable>
);
export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const Empty = ({ title, hint }) => (
  <View style={{ alignItems: 'center', padding: 40 }}>
    <Text style={{ fontSize: 40 }}>☕</Text>
    <Text style={{ fontWeight: '700', fontSize: 16, color: C.roast, marginTop: 8 }}>{title}</Text>
    {hint ? <Text style={{ color: C.muted, marginTop: 4, textAlign: 'center' }}>{hint}</Text> : null}
  </View>
);
const s = StyleSheet.create({
  btn: { backgroundColor: C.pink, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ghost: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.roast },
  danger: { backgroundColor: C.white, borderWidth: 1.5, borderColor: '#B3261E' },
  btnT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, marginRight: 8 },
  chipOn: { backgroundColor: C.roast, borderColor: C.roast },
  chipT: { color: C.roast, fontWeight: '600' },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line }
});
