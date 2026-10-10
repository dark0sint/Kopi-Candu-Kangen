import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { C, rp } from '../theme';
import { Button, Card, Empty } from '../ui';

export default function CourierScreen() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const rowsRef = useRef([]);
  const load = useCallback(async () => {
    setBusy(true);
    try { const r = await api('/courier/orders'); setRows(r); rowsRef.current = r; } catch (e) { Alert.alert('Gagal', e.message); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]));

  // Kirim lokasi kurir tiap 8 detik selama ada pesanan "delivering" dan layar kurir terbuka
  useFocusEffect(useCallback(() => {
    const t = setInterval(async () => {
      if (!rowsRef.current.some(o => o.status === 'delivering')) return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const p = await Location.getCurrentPositionAsync({}).catch(() => null);
      if (p) api('/courier/location', { method: 'POST', body: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, []));

  const move = async (o, status) => {
    try { await api(`/courier/orders/${o.id}/status`, { method: 'POST', body: { status } }); load(); }
    catch (e) { Alert.alert('Gagal', e.message); }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.foam }} edges={['top']}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: C.roast, padding: 16 }}>Tugas kurir</Text>
      <FlatList data={rows} keyExtractor={o => String(o.id)} contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        ListEmptyComponent={!busy && <Empty title="Belum ada tugas" hint="Pesanan yang ditugaskan admin akan muncul di sini" />}
        renderItem={({ item: o }) => (
          <Card>
            <Text style={{ fontWeight: '900', color: C.roast }}>{o.code} · {o.customer_name}</Text>
            <Text style={{ color: C.muted }}>{o.customer_phone}</Text>
            <Text style={{ marginTop: 6 }}>Ambil: {o.outlet_name}</Text>
            <Text>Antar: {o.address}</Text>
            <Text style={{ marginTop: 6, fontWeight: '800' }}>{o.payment_method === 'cod' ? `Tagih tunai ${rp(o.total)}` : 'Sudah dibayar online'}</Text>
            <View style={{ marginTop: 10 }}>
              {o.status === 'ready' && <Button title="Ambil pesanan & berangkat" onPress={() => move(o, 'delivering')} />}
              {o.status === 'delivering' && <Button title="Pesanan sudah sampai" onPress={() => move(o, 'completed')} />}
            </View>
          </Card>
        )} />
    </SafeAreaView>
  );
}
