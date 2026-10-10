import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../api';
import { useApp } from '../context';
import { C, rp } from '../theme';
import { Button, Chip, Card, Empty } from '../ui';

const SCHEDULES = [
  { k: 'now', label: 'Sekarang' }, { k: '30', label: '30 menit lagi' }, { k: '60', label: '1 jam lagi' },
  { k: '120', label: '2 jam lagi' }, { k: 'tmr', label: 'Besok 08:00' }
];
const PAY = [
  { k: 'qris', label: '📱 QRIS' }, { k: 'ewallet', label: '👛 E-wallet (GoPay/ShopeePay)' },
  { k: 'bank', label: '🏦 Transfer bank (VA)' }, { k: 'cod', label: '💵 Bayar di tempat' }
];
function whenISO(k) {
  if (k === 'now') return null;
  if (k === 'tmr') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.toISOString(); }
  return new Date(Date.now() + (+k) * 60000 + 60000).toISOString();
}

export default function CheckoutScreen({ navigation }) {
  const { cart, changeQty, subtotal, clearCart } = useApp();
  const [type, setType] = useState('delivery');
  const [address, setAddress] = useState('');
  const [coord, setCoord] = useState(null);
  const [quote, setQuote] = useState(null);
  const [sched, setSched] = useState('now');
  const [pay, setPay] = useState('qris');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const outlet = cart.outlet;

  useEffect(() => {
    if (type !== 'delivery' || !coord || !outlet) { setQuote(null); return; }
    api(`/quote?outlet_id=${outlet.id}&lat=${coord.latitude}&lng=${coord.longitude}`).then(setQuote).catch(() => setQuote(null));
  }, [coord, type, outlet?.id]);

  if (!cart.items.length) return <Empty title="Keranjang masih kosong" hint="Pilih menu dari outlet dulu ya" />;

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Izin lokasi ditolak', 'Aktifkan izin lokasi atau geser pin di peta.');
    const p = await Location.getCurrentPositionAsync({});
    await setPin({ latitude: p.coords.latitude, longitude: p.coords.longitude }, true);
  };
  const setPin = async (c, fill) => {
    setCoord(c);
    if (fill || !address) {
      const r = await Location.reverseGeocodeAsync(c).catch(() => []);
      if (r[0]) setAddress([r[0].street, r[0].name, r[0].district, r[0].city].filter(Boolean).join(', '));
    }
  };

  const fee = type === 'delivery' ? (quote?.delivery_fee || 0) : 0;
  const total = subtotal + fee;
  const submit = async () => {
    if (type === 'delivery' && (!coord || address.trim().length < 5)) return Alert.alert('Alamat belum lengkap', 'Isi alamat dan tentukan titik di peta.');
    if (type === 'delivery' && quote && !quote.deliverable) return Alert.alert('Di luar jangkauan', `Maksimal ${quote.max_km} km dari outlet.`);
    setBusy(true);
    try {
      const o = await api('/orders', { method: 'POST', body: {
        outlet_id: outlet.id, type, address, lat: coord?.latitude, lng: coord?.longitude, notes,
        scheduled_at: whenISO(sched), payment_method: pay,
        items: cart.items.map(i => ({ product_id: i.product.id, qty: i.qty, options: i.options }))
      } });
      clearCart();
      navigation.replace('OrderDetail', { id: o.id });
      if (o.payment_url) WebBrowser.openBrowserAsync(o.payment_url);
    } catch (e) { Alert.alert('Gagal memesan', e.message); }
    setBusy(false);
  };

  return (
    <ScrollView style={{ backgroundColor: C.foam }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={s.h}>{outlet.name}</Text>
        {cart.items.map(i => (
          <View key={i.key} style={s.line}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: C.roast }}>{i.product.name}</Text>
              {!!i.optionText && <Text style={{ color: C.muted, fontSize: 12 }}>{i.optionText}</Text>}
              <Text style={{ color: C.roast }}>{rp(i.unitPrice * i.qty)}</Text>
            </View>
            <Pressable onPress={() => changeQty(i.key, -1)} style={s.q}><Text style={s.qt}>−</Text></Pressable>
            <Text style={{ width: 28, textAlign: 'center', fontWeight: '800' }}>{i.qty}</Text>
            <Pressable onPress={() => changeQty(i.key, 1)} style={s.q}><Text style={s.qt}>+</Text></Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.h}>Cara terima pesanan</Text>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="🛵 Diantar kurir" on={type === 'delivery'} onPress={() => setType('delivery')} />
          <Chip label="🏪 Ambil sendiri" on={type === 'pickup'} onPress={() => { setType('pickup'); if (pay === 'cod') setPay('cod'); }} />
        </View>
        {type === 'delivery' ? (
          <>
            <TextInput style={s.in} placeholder="Alamat lengkap (jalan, nomor, patokan)" value={address} onChangeText={setAddress} multiline />
            <Button title="📍 Gunakan lokasi saya" kind="ghost" onPress={useMyLocation} />
            <MapView style={s.map}
              initialRegion={{ latitude: outlet.lat, longitude: outlet.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              onPress={(e) => setPin(e.nativeEvent.coordinate)}>
              <Marker coordinate={{ latitude: outlet.lat, longitude: outlet.lng }} title="Outlet" pinColor="#2A1B17" />
              {coord && <Marker coordinate={coord} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate, true)} title="Antar ke sini" pinColor="#E8487E" />}
            </MapView>
            <Text style={{ color: C.muted, marginTop: 6 }}>
              {quote ? `${quote.distance_km} km dari outlet · ongkir ${rp(quote.delivery_fee)}` : 'Ketuk peta atau geser pin untuk menentukan titik antar'}
            </Text>
          </>
        ) : (
          <Text style={{ color: C.muted, marginTop: 10 }}>Ambil di {outlet.address}. Tanpa antre kasir, tinggal sebut kode pesanan.</Text>
        )}
      </Card>

      <Card>
        <Text style={s.h}>Waktu</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{SCHEDULES.map(x => <Chip key={x.k} label={x.label} on={sched === x.k} onPress={() => setSched(x.k)} />)}</ScrollView>
      </Card>

      <Card>
        <Text style={s.h}>Pembayaran</Text>
        {PAY.map(p => (
          <Pressable key={p.k} onPress={() => setPay(p.k)} style={[s.pay, pay === p.k && { borderColor: C.pink, backgroundColor: '#FDEAF1' }]}>
            <Text style={{ fontWeight: '600', color: C.roast }}>{p.k === 'cod' && type === 'pickup' ? '💵 Bayar di kasir' : p.label}</Text>
          </Pressable>
        ))}
        <TextInput style={s.in} placeholder="Catatan untuk outlet/kurir (opsional)" value={notes} onChangeText={setNotes} />
      </Card>

      <Card>
        <View style={s.sum}><Text>Subtotal</Text><Text>{rp(subtotal)}</Text></View>
        {type === 'delivery' && <View style={s.sum}><Text>Ongkir</Text><Text>{quote ? rp(fee) : '-'}</Text></View>}
        <View style={s.sum}><Text style={{ fontWeight: '900', fontSize: 17 }}>Total</Text><Text style={{ fontWeight: '900', fontSize: 17 }}>{rp(total)}</Text></View>
      </Card>
      <Button title={busy ? 'Memproses...' : `Pesan sekarang · ${rp(total)}`} onPress={submit} disabled={busy} />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  h: { fontWeight: '900', fontSize: 16, color: C.roast, marginBottom: 10 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line },
  q: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.foam, alignItems: 'center', justifyContent: 'center' },
  qt: { fontSize: 18, fontWeight: '800', color: C.roast },
  in: { backgroundColor: C.foam, borderRadius: 12, padding: 12, marginVertical: 10, fontSize: 15 },
  map: { height: 220, borderRadius: 14, marginTop: 10 },
  pay: { borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 8 },
  sum: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }
});
