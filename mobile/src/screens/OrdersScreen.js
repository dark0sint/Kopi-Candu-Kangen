import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { C, rp, STATUS } from '../theme';
import { Card, Empty } from '../ui';

export default function OrdersScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setRows(await api('/orders')); } catch (e) { setErr(e.message); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.foam }} edges={['top']}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: C.roast, padding: 16 }}>Pesanan saya</Text>
      <FlatList
        data={rows} keyExtractor={(o) => String(o.id)} contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        ListEmptyComponent={!busy && <Empty title={err || 'Belum ada pesanan'} hint={err ? 'Tarik ke bawah untuk coba lagi' : 'Pesan kopi pertamamu dari Beranda'} />}
        renderItem={({ item: o }) => (
          <Pressable onPress={() => navigation.navigate('OrderDetail', { id: o.id })}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: C.roast }}>{o.code}</Text>
                <Text style={{ fontWeight: '700', color: o.status === 'cancelled' ? '#B3261E' : o.status === 'completed' ? C.ok : C.pink }}>{STATUS[o.status]}</Text>
              </View>
              <Text style={{ color: C.muted, marginTop: 4 }}>{o.outlet_name.replace('Kopi Candu Kangen - ', '')} · {o.type === 'pickup' ? 'Ambil sendiri' : 'Diantar'}</Text>
              <Text style={{ marginTop: 6, color: C.roast }}>{o.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</Text>
              <Text style={{ marginTop: 6, fontWeight: '800', color: C.roast }}>{rp(o.total)}</Text>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
