import React from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppProvider, useApp } from './src/context';
import { C } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import MenuScreen from './src/screens/MenuScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CourierScreen from './src/screens/CourierScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  const { user } = useApp();
  const icon = (e) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{e}</Text>;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: C.pink, tabBarInactiveTintColor: C.muted }}>
      <Tab.Screen name="Beranda" component={HomeScreen} options={{ tabBarIcon: icon('🏠') }} />
      <Tab.Screen name="Pesanan" component={OrdersScreen} options={{ tabBarIcon: icon('🧾') }} />
      {user.role === 'courier' && <Tab.Screen name="Kurir" component={CourierScreen} options={{ tabBarIcon: icon('🛵') }} />}
      <Tab.Screen name="Akun" component={ProfileScreen} options={{ tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready } = useApp();
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.roast, justifyContent: 'center' }}><ActivityIndicator color={C.pink} size="large" /></View>;
  const hdr = { headerStyle: { backgroundColor: C.roast }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } };
  return (
    <Stack.Navigator screenOptions={hdr}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Menu" component={MenuScreen} options={({ route }) => ({ title: route.params?.outlet?.name?.replace('Kopi Candu Kangen - ', '') || 'Menu' })} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Pesanan kamu' }} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Lacak pesanan' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Root />
      </NavigationContainer>
    </AppProvider>
  );
}
