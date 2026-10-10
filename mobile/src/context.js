import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, setToken } from './api';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState({ outlet: null, items: [] });

  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync('kck_token');
        if (t) { setToken(t); setUser(await api('/me')); }
      } catch { await SecureStore.deleteItemAsync('kck_token').catch(() => {}); setToken(null); }
      setReady(true);
    })();
  }, []);

  const signIn = async (path, body) => {
    const r = await api(path, { method: 'POST', body });
    setToken(r.token);
    await SecureStore.setItemAsync('kck_token', r.token);
    setUser(r.user);
  };
  const signOut = async () => { setToken(null); await SecureStore.deleteItemAsync('kck_token'); setUser(null); setCart({ outlet: null, items: [] }); };

  const addItem = (outlet, product, options, unitPrice, optionText, qty = 1) => {
    const doAdd = (base) => {
      const key = product.id + '|' + optionText;
      const found = base.items.find(i => i.key === key);
      const items = found ? base.items.map(i => i.key === key ? { ...i, qty: i.qty + qty } : i)
        : [...base.items, { key, product, options, unitPrice, optionText, qty }];
      setCart({ outlet, items });
    };
    if (cart.outlet && cart.outlet.id !== outlet.id && cart.items.length) {
      Alert.alert('Ganti outlet?', 'Keranjang berisi menu dari outlet lain. Kosongkan dan mulai dari outlet ini?', [
        { text: 'Batal', style: 'cancel' }, { text: 'Ya, ganti', onPress: () => doAdd({ outlet, items: [] }) }]);
    } else doAdd(cart);
  };
  const changeQty = (key, d) => setCart(c => {
    const items = c.items.map(i => i.key === key ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0);
    return { outlet: items.length ? c.outlet : null, items };
  });
  const clearCart = () => setCart({ outlet: null, items: [] });
  const subtotal = cart.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const count = cart.items.reduce((s, i) => s + i.qty, 0);

  const value = useMemo(() => ({ user, ready, signIn, signOut, cart, addItem, changeQty, clearCart, subtotal, count }), [user, ready, cart]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
