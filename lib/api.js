export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Terjadi kesalahan'), { status: res.status });
  return data;
}
