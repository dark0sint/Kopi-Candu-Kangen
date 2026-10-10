import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useApp } from '../context';
import { C } from '../theme';
import { Chip, Card, Empty } from '../ui';

export default function HomeScreen({ navigation }) {
  const { user, count } = useApp();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('distance');
  const [pos, setPos] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const p = await Location.getCurrentPositionAsync({}).catch(() => null);
        if (p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const qs = new URLSearchParams({ sort, ...(q ? { q } : {}), ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) });
      setRows(await api('/outlets?' + qs));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }, [q, sort, pos]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.foam }} edges={['top']}>
      <View style={s.head}>
        <Text style={s.hi}>Halo, {user.name.split(' ')[0]}</Text>
        <Text style={s.q}>Lagi kangen kopi apa hari ini?</Text>
        <TextInput style={s.search} placeholder="Cari outlet atau daerah" value={q} onChangeText={setQ} onSubmitEditing={load} returnKeyType="search" />
      </View>
      <View style={{ flexDirection: 'row', padding: 12 }}>
        <Chip label="Terdekat" on={sort === 'distance'} onPress={() => setSort('distance')} />
        <Chip label="Rating tertinggi" on={sort === 'rating'} onPress={() => setSort('rating')} />
      </View>
      <FlatList
        data={rows} keyExtractor={(o) => String(o.id)} contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        ListEmptyComponent={!busy && <Empty title={err || 'Outlet tidak ditemukan'} hint={err ? 'Tarik ke bawah untuk coba lagi' : 'Coba kata kunci lain'} />}
        renderItem={({ item: o }) => (
          <Pressable onPress={() => navigation.navigate('Menu', { outlet: o })}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.name}>{o.name.replace('Kopi Candu Kangen - ', '')}</Text>
                <Text style={[s.badge, { backgroundColor: o.open ? '#DDF1E8' : '#F3D9D6', color: o.open ? C.ok : '#B3261E' }]}>{o.open ? 'Buka' : 'Tutup'}</Text>
              </View>
              <Text style={{ color: C.muted, marginTop: 4 }}>{o.address}</Text>
              <Text style={{ marginTop: 8, color: C.roast, fontWeight: '600' }}>
                ★ {o.rating}{o.distance_km != null ? `   ·   ${o.distance_km} km` : ''}   ·   {o.open_hour}:00-{o.close_hour}:00
              </Text>
            </Card>
          </Pressable>
        )}
      />
      {count > 0 && (
        <Pressable style={s.fab} onPress={() => navigation.navigate('Checkout')}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>🛒 Lihat keranjang ({count})</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  head: { backgroundColor: C.roast, padding: 16, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  hi: { color: C.latte, fontSize: 14 }, q: { color: '#fff', fontSize: 22, fontWeight: '800', marginVertical: 6 },
  search: { backgroundColor: '#fff', borderRadius: 14, padding: 12, fontSize: 15, marginTop: 6 },
  name: { fontSize: 17, fontWeight: '800', color: C.roast },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, fontWeight: '700', fontSize: 12, overflow: 'hidden' },
  fab: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: C.pink, borderRadius: 16, padding: 16, alignItems: 'center' }
});
