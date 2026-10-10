import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { api } from '../api';
import { useApp } from '../context';
import { C, rp, CAT_ICON } from '../theme';
import { Button, Chip, Card } from '../ui';

export default function MenuScreen({ route, navigation }) {
  const { addItem, count, subtotal } = useApp();
  const [data, setData] = useState(null);
  const [cat, setCat] = useState(null);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState(null);
  const [sel, setSel] = useState({});
  const [qty, setQty] = useState(1);

  useEffect(() => {
    api(`/outlets/${route.params.outlet.id}/menu`).then(d => { setData(d); setCat(d.categories[0]); }).catch(e => setErr(e.message));
  }, []);
  if (err) return <Text style={{ padding: 20 }}>{err}</Text>;
  if (!data) return <ActivityIndicator style={{ marginTop: 40 }} color={C.pink} />;

  const open = (p) => {
    const init = {};
    p.options.forEach(o => { if (o.required) init[o.name] = [o.choices[0].label]; });
    setSel(init); setQty(1); setPick(p);
  };
  const toggle = (o, label) => {
    const cur = sel[o.name] || [];
    setSel({ ...sel, [o.name]: o.multiple ? (cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label]) : [label] });
  };
  const extra = pick ? pick.options.reduce((s, o) => s + (sel[o.name] || []).reduce((a, l) => a + (o.choices.find(c => c.label === l)?.price || 0), 0), 0) : 0;
  const unit = pick ? pick.price + extra : 0;
  const confirm = () => {
    const options = {}; const texts = [];
    pick.options.forEach(o => { const v = sel[o.name] || []; if (v.length) { options[o.name] = o.multiple ? v : v[0]; texts.push(`${o.name}: ${v.join(', ')}`); } });
    addItem(data.outlet, pick, options, unit, texts.join(' | '), qty);
    setPick(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.foam }}>
      {!data.outlet.open && <Text style={s.closed}>Outlet sedang tutup. Kamu masih bisa pesan terjadwal.</Text>}
      <View style={{ height: 56 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10 }}>
          {data.categories.map(c => <Chip key={c} label={`${CAT_ICON[c] || '🥤'} ${c}`} on={cat === c} onPress={() => setCat(c)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={data.products.filter(p => p.category === cat)} keyExtractor={p => String(p.id)} contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        renderItem={({ item: p }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', opacity: p.available ? 1 : 0.5 }}>
            <View style={s.img}><Text style={{ fontSize: 34 }}>{CAT_ICON[p.category] || '🥤'}</Text></View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: C.roast }}>{p.name}</Text>
              <Text style={{ color: C.muted, fontSize: 13, marginVertical: 2 }}>{p.description}</Text>
              <Text style={{ fontWeight: '700', color: C.roast }}>{rp(p.price)}</Text>
            </View>
            <Pressable disabled={!p.available} onPress={() => open(p)} style={s.add}><Text style={{ color: '#fff', fontWeight: '800' }}>{p.available ? 'Tambah' : 'Habis'}</Text></Pressable>
          </Card>
        )}
      />
      {count > 0 && (
        <Pressable style={s.fab} onPress={() => navigation.navigate('Checkout')}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>🛒 {count} item · {rp(subtotal)}  Lanjut bayar</Text>
        </Pressable>
      )}
      <Modal visible={!!pick} transparent animationType="slide" onRequestClose={() => setPick(null)}>
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
          <View style={s.sheet}>
            <ScrollView>
              <Text style={{ fontSize: 20, fontWeight: '900', color: C.roast }}>{pick?.name}</Text>
              {pick?.options.map(o => (
                <View key={o.name} style={{ marginTop: 14 }}>
                  <Text style={{ fontWeight: '700', color: C.roast }}>{o.name}{o.multiple ? ' (boleh lebih dari satu)' : ''}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                    {o.choices.map(c => <Chip key={c.label} label={c.label + (c.price ? ` +${rp(c.price)}` : '')} on={(sel[o.name] || []).includes(c.label)} onPress={() => toggle(o, c.label)} />)}
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 18 }}>
                <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={s.q}><Text style={s.qt}>−</Text></Pressable>
                <Text style={{ fontSize: 20, fontWeight: '800', marginHorizontal: 24 }}>{qty}</Text>
                <Pressable onPress={() => setQty(Math.min(20, qty + 1))} style={s.q}><Text style={s.qt}>+</Text></Pressable>
              </View>
              <Button title={`Masukkan keranjang · ${rp(unit * qty)}`} onPress={confirm} />
              <Button title="Batal" kind="ghost" style={{ marginTop: 8 }} onPress={() => setPick(null)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  closed: { backgroundColor: '#F3D9D6', color: '#B3261E', padding: 10, textAlign: 'center', fontWeight: '600' },
  img: { width: 64, height: 64, borderRadius: 14, backgroundColor: C.latte, alignItems: 'center', justifyContent: 'center' },
  add: { backgroundColor: C.pink, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  fab: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: C.roast, borderRadius: 16, padding: 16, alignItems: 'center' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  q: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.foam, alignItems: 'center', justifyContent: 'center' },
  qt: { fontSize: 22, fontWeight: '800', color: C.roast }
});
