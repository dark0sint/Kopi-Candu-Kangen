import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, ScrollView, Platform, Alert, StyleSheet } from 'react-native';
import { useApp } from '../context';
import { C } from '../theme';
import { Button } from '../ui';

export default function AuthScreen() {
  const { signIn } = useApp();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = async () => {
    setBusy(true);
    try { await signIn(mode === 'login' ? '/auth/login' : '/auth/register', f); }
    catch (e) { Alert.alert('Gagal', e.message); }
    setBusy(false);
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.roast }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <Text style={s.brand}>Kopi Candu{'\n'}<Text style={{ color: C.pink }}>Kangen</Text></Text>
        <Text style={s.tag}>Sekali sruput, pengen lagi. Pesan, kami antar.</Text>
        <View style={s.sheet}>
          {mode === 'register' && <>
            <TextInput style={s.in} placeholder="Nama lengkap" value={f.name} onChangeText={set('name')} />
            <TextInput style={s.in} placeholder="No. HP" keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
          </>}
          <TextInput style={s.in} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
          <TextInput style={s.in} placeholder="Password" secureTextEntry value={f.password} onChangeText={set('password')} />
          <Button title={busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'} onPress={submit} disabled={busy} />
          <Text style={s.sw} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  brand: { color: '#fff', fontSize: 44, fontWeight: '900', lineHeight: 48 },
  tag: { color: C.latte, marginTop: 10, fontSize: 15 },
  sheet: { backgroundColor: C.foam, borderRadius: 24, padding: 20, marginTop: 36 },
  in: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, fontSize: 16, borderWidth: 1, borderColor: C.line },
  sw: { textAlign: 'center', marginTop: 16, color: C.roast, fontWeight: '700' }
});
