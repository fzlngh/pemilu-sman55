'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, API } from '../../lib/api';

const COLORS = ['#b2450e', '#f2b04a', '#8b2a3a', '#c87812', '#f77d1e', '#68625d'];
const plain = { letterSpacing: 0 };

// Perkecil foto di browser (maks 900px, JPEG) agar upload ringan dan cepat.
function resizeImage(file, max = 900) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto'))), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File bukan gambar yang valid')); };
    img.src = url;
  });
}

export default function Admin() {
  const [tok, setTok] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('stat');
  const [stats, setStats] = useState(null);
  const [voters, setVoters] = useState([]);
  const [bulk, setBulk] = useState('');
  const [msg, setMsg] = useState('');
  const [photo, setPhoto] = useState(null); // { blob, preview }
  const [saving, setSaving] = useState(false);
  const [candErr, setCandErr] = useState('');
  const [cn, setCn] = useState({ number: '', name: '', vision: '' });

  useEffect(() => { setTok(sessionStorage.getItem('adm')); }, []);
  const load = useCallback(async () => {
    if (!tok) return;
    try {
      setStats(await api('/admin/stats', { token: tok }));
      setVoters(await api('/admin/voters', { token: tok }));
    } catch { sessionStorage.removeItem('adm'); setTok(null); }
  }, [tok]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const login = async (e) => {
    e.preventDefault();
    try { const r = await api('/admin/login', { method: 'POST', body: { password: pw } }); sessionStorage.setItem('adm', r.token); setTok(r.token); }
    catch (x) { setErr(x.message); }
  };
  const addVoters = async () => {
    const list = bulk.split(/[\s,;]+/).filter(Boolean);
    const r = await api('/admin/voters', { method: 'POST', token: tok, body: { nisn: list } });
    setMsg(`${r.added} NISN ditambahkan` + (r.skipped.length ? `, ${r.skipped.length} dilewati (tidak valid atau duplikat)` : ''));
    setBulk(''); load();
  };
  const act = async (path, method) => { await api(path, { method, token: tok }); load(); };
  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setCandErr('');
    try {
      const blob = await resizeImage(f);
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (x) { setCandErr(x.message); }
  };
  const clearPhoto = () => { if (photo) URL.revokeObjectURL(photo.preview); setPhoto(null); };
  const addCand = async () => {
    setSaving(true); setCandErr('');
    try {
      let photo_url = '';
      if (photo) {
        const res = await fetch(API + '/api/admin/upload', {
          method: 'POST', headers: { 'Content-Type': 'image/jpeg', Authorization: 'Bearer ' + tok }, body: photo.blob,
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Gagal mengunggah foto');
        photo_url = d.url;
      }
      await api('/admin/candidates', { method: 'POST', token: tok, body: { ...cn, number: +cn.number, photo_url } });
      setCn({ number: '', name: '', vision: '' }); clearPhoto(); load();
    } catch (x) { setCandErr(x.message); }
    finally { setSaving(false); }
  };

  if (!tok) return (
    <main className="wrap" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <motion.form onSubmit={login} className="card" style={{ width: 360 }} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h2 style={{ marginBottom: 14 }}>Masuk admin</h2>
        <input className="field" type="password" style={plain} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn punch" style={{ marginTop: 14, width: '100%' }}>Masuk</button>
        {err && <p className="err">{err}</p>}
      </motion.form>
    </main>
  );

  const data = stats?.results.map((r) => ({ name: `${r.number}. ${r.name}`, votes: r.votes })) || [];
  const blocked = voters.filter((v) => v.blocked);
  const sorted = [...voters].sort((a, b) => b.blocked - a.blocked || a.nisn.localeCompare(b.nisn));
  return (
    <main className="wrap">
      <img src="/logo-sman55.png" alt="Logo SMA Negeri 55 Jakarta" className="logo" style={{ width: 180 }} />
      <h1 style={{ fontSize: '2.4rem' }}>Panel panitia</h1>
      <div className="tabs">
        {[['stat', 'Hasil'], ['voters', 'Pemilih'], ['cand', 'Kandidat']].map(([k, l]) => (
          <button key={k} className={'btn ' + (tab === k ? 'punch' : 'ghost')} onClick={() => setTab(k)}>
            {l}{k === 'voters' && blocked.length ? ` (${blocked.length} terblokir)` : ''}
          </button>
        ))}
      </div>

      {tab === 'stat' && stats && (
        <>
          <div className="grid" style={{ marginBottom: 20 }}>
            {[['Pemilih terdaftar', stats.total], ['Sudah memilih', stats.voted], ['Partisipasi', stats.total ? Math.round((stats.voted / stats.total) * 100) + '%' : '0%'], ['Terblokir', stats.blocked]].map(([l, v], i) => (
              <motion.div key={l} className="card" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}>
                <div className="stat">{v}</div><div>{l}</div>
              </motion.div>
            ))}
          </div>
          <div className="grid">
            <div className="card" style={{ height: 340 }}>
              <ResponsiveContainer><BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="votes" name="Suara" radius={[8, 8, 0, 0]} animationDuration={1200}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
              </BarChart></ResponsiveContainer>
            </div>
            <div className="card" style={{ height: 340 }}>
              <ResponsiveContainer><PieChart>
                <Pie data={data} dataKey="votes" nameKey="name" outerRadius={110} innerRadius={50} animationDuration={1200}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip />
              </PieChart></ResponsiveContainer>
            </div>
          </div>
          <p style={{ marginTop: 14 }}>Grafik hanya menampilkan jumlah suara per kandidat. Tidak ada data siapa memilih siapa.</p>
        </>
      )}

      {tab === 'voters' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2>Tambah NISN</h2>
            <textarea className="field" rows={4} style={{ ...plain, margin: '12px 0' }} placeholder="Tempel banyak NISN, pisahkan dengan baris baru atau koma" value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button className="btn punch" onClick={addVoters} disabled={!bulk.trim()}>Tambahkan</button>
            {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>NISN</th><th>Status</th><th>Alasan blokir</th><th></th></tr></thead>
              <tbody>
                {sorted.map((v) => (
                  <tr key={v.nisn}>
                    <td>{v.nisn}</td>
                    <td>{v.blocked ? '🔒 Terblokir' : v.voted ? '✅ Sudah memilih' : 'Belum memilih'}</td>
                    <td>{v.reason}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      {v.blocked && <button className="btn punch" onClick={() => act(`/admin/voters/${v.nisn}/unblock`, 'POST')}>Buka blokir</button>}
                      <button className="btn ghost" onClick={() => confirm('Hapus NISN ' + v.nisn + '?') && act(`/admin/voters/${v.nisn}`, 'DELETE')}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cand' && (
        <>
          <div className="card" style={{ marginBottom: 20, display: 'grid', gap: 10 }}>
            <h2>Tambah kandidat</h2>
            <input className="field" style={plain} placeholder="Nomor urut" value={cn.number} onChange={(e) => setCn({ ...cn, number: e.target.value })} />
            <input className="field" style={plain} placeholder="Nama" value={cn.name} onChange={(e) => setCn({ ...cn, name: e.target.value })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {photo
                ? <img src={photo.preview} alt="Pratinjau foto" style={{ width: 96, height: 120, objectFit: 'cover', objectPosition: 'center top', borderRadius: 12, border: '2px solid var(--line)' }} />
                : <div style={{ width: 96, height: 120, borderRadius: 12, border: '2px dashed var(--line)', display: 'grid', placeItems: 'center', fontSize: '.85rem', textAlign: 'center', padding: 6 }}>Belum ada foto</div>}
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="btn ghost" style={{ display: 'inline-block', textAlign: 'center' }}>
                  {photo ? 'Ganti foto' : 'Pilih foto'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display: 'none' }} />
                </label>
                {photo && <button type="button" className="btn ghost" onClick={clearPhoto}>Hapus foto</button>}
                <span style={{ fontSize: '.85rem' }}>JPG, PNG, atau WebP. Opsional.</span>
              </div>
            </div>
            <textarea className="field" rows={3} style={plain} placeholder="Visi dan misi" value={cn.vision} onChange={(e) => setCn({ ...cn, vision: e.target.value })} />
            <button className="btn punch" onClick={addCand} disabled={!cn.name || !cn.number || saving}>{saving ? 'Menyimpan…' : 'Simpan kandidat'}</button>
            {candErr && <p className="err">{candErr}</p>}
          </div>
          <div className="grid">
            {stats?.results.map((c) => (
              <div className="card" key={c.id}>
                {c.photo_url && <img src={c.photo_url} alt={`Foto ${c.name}`} style={{ width: 96, height: 120, objectFit: 'cover', objectPosition: 'center top', borderRadius: 12, marginBottom: 10 }} />}
                <h2>{c.number}. {c.name}</h2><p style={{ margin: '8px 0 14px' }}>{c.vision}</p>
                <button className="btn ghost" onClick={() => confirm('Hapus kandidat ini?') && act(`/admin/candidates/${c.id}`, 'DELETE')}>Hapus</button></div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}