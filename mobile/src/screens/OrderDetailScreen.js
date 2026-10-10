import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../api';
import { C, rp, STATUS } from '../theme';
import { Button, Card } from '../ui';

const STEPS = {
  delivery: ['placed', 'preparing', 'ready', 'delivering', 'completed'],
  pickup: ['placed', 'preparing', 'ready', 'completed']
};
const STEP_LABEL = (type) => ({
  placed: 'Pesanan diterima', preparing: 'Sedang diracik',
  ready: type === 'pickup' ? 'Siap diambil di outlet' : 'Siap, menunggu kurir',
  delivering: 'Kurir menuju lokasimu', completed: type === 'pickup' ? 'Sudah diambil' : 'Pesanan sampai'
});

export default function OrderDetailScreen({ route }) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const alive = useRef(true);
  const load = useCallback(async () => {
    try { const d = await api('/orders/' + route.params.id); if (alive.current) setO(d); }
    catch (e) { if (alive.current) setErr(e.message); }
  }, [route.params.id]);
  useEffect(() => {
    alive.current = true; load();
    const t = setInterval(load, 5000);
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  if (err && !o) return <Text style={{ padding: 20 }}>{err}</Text>;
  if (!o) return <ActivityIndicator style={{ marginTop: 40 }} color={C.pink} />;

  const steps = STEPS[o.type];
  const idx = steps.indexOf(o.status);
  const cancelled = o.status === 'cancelled';
  const pay = async () => {
    try {
      let url = o.payment_url;
      if (!url) { const d = await api(`/orders/${o.id}/pay`, { method: 'POST' }); url = d.payment_url; setO(d); }
      if (url) await WebBrowser.openBrowserAsync(url);
      else Alert.alert('Menunggu konfirmasi', 'Pembayaran akan dikonfirmasi oleh outlet.');
      load();
    } catch (e) { Alert.alert('Gagal', e.message); }
  };
  const cancel = () => Alert.alert('Batalkan pesanan?', '', [
    { text: 'Tidak', style: 'cancel' },
    { text: 'Ya, batalkan', style: 'destructive', onPress: async () => { try { setO(await api(`/orders/${o.id}/cancel`, { method: 'POST' })); } catch (e) { Alert.alert('Gagal', e.message); } } }
  ]);

  return (
    <ScrollView style={{ backgroundColor: C.foam }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <Card>
        <Text style={{ color: C.muted }}>Kode pesanan</Text>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.roast }}>{o.code}</Text>
        <Text style={{ marginTop: 6, fontWeight: '800', fontSize: 16, color: cancelled ? '#B3261E' : C.pink }}>
          {o.status === 'pending_payment' ? STATUS.pending_payment : cancelled ? STATUS.cancelled : STEP_LABEL(o.type)[o.status]}
        </Text>
        {!!o.scheduled_at && <Text style={{ color: C.muted, marginTop: 4 }}>Dijadwalkan: {new Date(o.scheduled_at).toLocaleString('id-ID')}</Text>}
        {o.courier_name && o.type === 'delivery' && !cancelled && <Text style={{ color: C.muted, marginTop: 4 }}>Kurir: {o.courier_name}</Text>}
      </Card>

      {o.status === 'delivering' && o.lat && (
        <MapView style={{ height: 240, borderRadius: 16, marginBottom: 12 }}
          region={{ latitude: o.courier_lat || o.lat, longitude: o.courier_lng || o.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}>
          <Marker coordinate={{ latitude: o.outlet_lat, longitude: o.outlet_lng }} title="Outlet" pinColor="#2A1B17" />
          <Marker coordinate={{ latitude: o.lat, longitude: o.lng }} title="Tujuan" pinColor="#E8487E" />
          {o.courier_lat && <Marker coordinate={{ latitude: o.courier_lat, longitude: o.courier_lng }} title="Kurir" pinColor="#2E7D5B" />}
        </MapView>
      )}

      {!cancelled && o.status !== 'pending_payment' && (
        <Card>
          {steps.map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i <= idx ? C.pink : C.line, alignItems: 'center', justifyContent: 'center' }}>
                {i <= idx && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={{ marginLeft: 12, color: i <= idx ? C.roast : C.muted, fontWeight: i === idx ? '800' : '500' }}>{STEP_LABEL(o.type)[s]}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        {o.items.map((i, k) => (
          <View key={k} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: '700', color: C.roast }}>{i.qty}× {i.name} <Text style={{ fontWeight: '400' }}>· {rp(i.unit_price * i.qty)}</Text></Text>
            {!!i.options_text && <Text style={{ color: C.muted, fontSize: 12 }}>{i.options_text}</Text>}
          </View>
        ))}
        <Text style={{ color: C.muted }}>{o.type === 'delivery' ? `Antar ke: ${o.address}` : `Ambil di: ${o.outlet_address}`}</Text>
        <Text style={{ marginTop: 8 }}>Ongkir {rp(o.delivery_fee)}</Text>
        <Text style={{ fontWeight: '900', fontSize: 17, color: C.roast }}>Total {rp(o.total)} · {o.payment_status === 'paid' ? 'Lunas' : o.payment_method === 'cod' ? 'Bayar di tempat' : 'Belum dibayar'}</Text>
      </Card>

      {o.status === 'pending_payment' && <Button title="Bayar sekarang" onPress={pay} />}
      {['pending_payment', 'placed'].includes(o.status) && o.payment_status !== 'paid' && <Button title="Batalkan pesanan" kind="danger" style={{ marginTop: 8 }} onPress={cancel} />}
    </ScrollView>
  );
}
