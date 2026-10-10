export const API = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
let token = null;
export const setToken = (t) => { token = t; };
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(API + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch { throw new Error('Tidak bisa terhubung ke server. Cek koneksi internet.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}
