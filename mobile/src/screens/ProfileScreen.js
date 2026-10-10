import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context';
import { C } from '../theme';
import { Button, Card } from '../ui';

export default function ProfileScreen() {
  const { user, signOut } = useApp();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.foam, padding: 16 }} edges={['top']}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: C.roast, marginBottom: 12 }}>Akun</Text>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.roast }}>{user.name}</Text>
        <Text style={{ color: C.muted, marginTop: 4 }}>{user.email}</Text>
        {!!user.phone && <Text style={{ color: C.muted }}>{user.phone}</Text>}
      </Card>
      <View style={{ marginTop: 8 }}><Button title="Keluar" kind="ghost" onPress={signOut} /></View>
    </SafeAreaView>
  );
}
