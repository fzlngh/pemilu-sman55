'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api, API } from '../../lib/api';
import { getSupabaseBrowserClient } from '../../lib/supabase';

const DONE_MS = 3600; // lama animasi sukses sebelum kembali ke halaman login

function Photo({ c }) {
  const [bad, setBad] = useState(false);
  const initials = c.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="cand-photo">
      {c.photo_url && !bad
        ? <img src={c.photo_url} alt={`Foto ${c.name}`} draggable={false} onError={() => setBad(true)} />
        : <span className="cand-initial" aria-hidden="true">{initials}</span>}
      <span className="cand-badge">{c.number}</span>
    </div>
  );
}

function Vote() {
  const router = useRouter();
  const params = useSearchParams();
  const [phase, setPhase] = useState('loading'); // loading | intro | voting | done | blocked
  const [cands, setCands] = useState([]);
  const [pick, setPick] = useState(null);
  const [err, setErr] = useState('');
  const tok = useRef('');
  const locked = useRef(false);

  useEffect(() => {
    if (params.get('blocked')) return setPhase('blocked');
    tok.current = sessionStorage.getItem('tok') || '';
    if (!tok.current) return router.replace('/');
    api('/me', { token: tok.current }).then(async (m) => {
      if (m.blocked) return setPhase('blocked');
      if (m.voted) { sessionStorage.removeItem('tok'); return setPhase('done'); }
      try {
        const sb = getSupabaseBrowserClient();
        const load = (cols) => sb.from('candidates').select(cols).order('number').order('id');
        let { data, error } = await load('id, number, name, vision, photo_url');
        if (error) ({ data, error } = await load('id, number, name, vision')); // kolom foto belum dimigrasi
        if (error) throw error;
        setCands(data);
        setPhase('intro');
      } catch (x) {
        setErr(x.message || 'Gagal memuat kandidat dari Supabase.');
        setPhase('load-error');
      }
    }).catch(() => router.replace('/'));
  }, [params, router]);

  const violate = useCallback((reason) => {
    if (locked.current) return;
    locked.current = true;
    fetch(API + '/api/violation', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok.current },
      body: JSON.stringify({ reason }),
    });
    sessionStorage.removeItem('tok');
    setPhase('blocked');
  }, []);

  useEffect(() => {
    if (phase !== 'voting') return;
    const onVis = () => document.hidden && violate('Berpindah tab/jendela');
    const onBlur = () => violate('Jendela kehilangan fokus');
    const onFs = () => !document.fullscreenElement && violate('Keluar dari layar penuh');
    const block = (e) => e.preventDefault();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
    };
  }, [phase, violate]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => router.replace('/'), DONE_MS);
    return () => clearTimeout(t);
  }, [phase, router]);

  const start = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setPhase('voting');
    } catch { setErr('Browser kamu tidak mendukung layar penuh. Gunakan Chrome, Edge, atau Firefox di laptop/PC.'); }
  };
  const submit = async () => {
    try {
      locked.current = true; // pemilihan selesai, kunci dilepas
      await api('/vote', { method: 'POST', token: tok.current, body: { candidateId: pick.id } });
      sessionStorage.removeItem('tok');
      if (document.fullscreenElement) await document.exitFullscreen();
      setPhase('done');
    } catch (x) { locked.current = false; setErr(x.message); setPick(null); }
  };

  if (phase === 'loading') return <main className="wrap"><p>Memuat…</p></main>;

  if (phase === 'load-error') return (
    <main className="wrap screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
        <h2>Kandidat tidak dapat dimuat</h2>
        <p className="err">{err}</p>
        <button className="btn punch" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Coba lagi</button>
      </div>
    </main>
  );

  if (phase === 'blocked') return (
    <main className="wrap screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <motion.div className="card" style={{ maxWidth: 460, textAlign: 'center', borderColor: 'var(--coral)' }}
        initial={{ scale: 0.7, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h2>Akunmu diblokir</h2>
        <p style={{ margin: '12px 0' }}>Kamu meninggalkan halaman pemilihan. Lapor ke admin atau panitia OSIS untuk membuka blokir.</p>
        <button className="btn ghost" onClick={() => router.push('/')}>Kembali</button>
      </motion.div>
    </main>
  );

  if (phase === 'done') return (
    <main className="wrap screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div>
        <svg width="140" height="140" viewBox="0 0 100 100">
          <motion.circle cx="50" cy="50" r="44" fill="none" stroke="#c87812" strokeWidth="6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
          <motion.path d="M28 52 L44 68 L72 34" fill="none" stroke="#c87812" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7, duration: 0.5 }} />
        </svg>
        <motion.h1 style={{ fontSize: '2.6rem', marginTop: 16 }} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.1 }}>Suaramu sudah tercatat</motion.h1>
        <p style={{ marginTop: 10 }}>Terima kasih sudah ikut memilih.</p>
        <div className="redirect-hint" aria-live="polite">
          <span>Kembali ke halaman login…</span>
          <div className="redirect-bar"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: (DONE_MS - 400) / 1000, ease: 'linear' }} /></div>
        </div>
      </div>
    </main>
  );

  if (phase === 'intro') return (
    <main className="wrap screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <motion.div className="card" style={{ maxWidth: 520 }} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <img src="/logo-sman55.png" alt="Logo SMA Negeri 55 Jakarta" className="logo" style={{ width: 200, marginBottom: 14 }} />
        <h2>Sebelum mulai</h2>
        <ul style={{ margin: '14px 0 20px 20px', lineHeight: 1.7 }}>
          <li>Pemilihan berjalan dalam layar penuh.</li>
          <li>Pindah tab, pindah jendela, atau keluar layar penuh akan langsung memblokir akunmu.</li>
          <li>Untuk membuka blokir, lapor ke admin.</li>
          <li>Satu NISN hanya bisa memilih satu kali.</li>
        </ul>
        <button className="btn punch" onClick={start}>Masuk layar penuh dan mulai</button>
        {err && <p className="err">{err}</p>}
      </motion.div>
    </main>
  );

  return (
    <main className="wrap vote-page" style={{ minHeight: '100vh' }}>
      <header className="vote-head">
        <img src="/logo-sman55.png" alt="Logo SMA Negeri 55 Jakarta" className="logo" style={{ width: 170 }} />
        <div>
          <motion.h1 className="vote-title" style={{ fontSize: '2.4rem', margin: '10px 0 24px' }} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>Pilih satu kandidat</motion.h1>
          <p className="vote-sub">Baca visi dan misi tiap kandidat, lalu pilih satu. Pilihan tidak dapat diubah.</p>
        </div>
      </header>
      {err && <p className="err">{err}</p>}
      <div className="grid cand-grid">
        {cands.map((c, i) => (
          <motion.div key={c.id} className="card cand-card" initial={{ opacity: 0, y: 60, rotate: i % 2 ? 3 : -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.15 * i, type: 'spring' }} whileHover={{ y: -8, rotate: i % 2 ? -1 : 1 }}>
            <Photo c={c} />
            <div className="cand-body">
              <div className="cand-number" style={{ fontSize: '4.5rem', fontWeight: 800, color: 'var(--coral)', lineHeight: 1 }}>{c.number}</div>
              <h2 className="cand-name" style={{ margin: '8px 0' }}>{c.name}</h2>
              <p className="cand-vision" style={{ marginBottom: 18 }}>{c.vision}</p>
              <motion.button whileTap={{ scale: 0.94 }} className="btn cand-btn" onClick={() => setPick(c)}>Pilih nomor {c.number}</motion.button>
            </div>
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {pick && (
          <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="card confirm-card" style={{ maxWidth: 420, textAlign: 'center' }} initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }} transition={{ type: 'spring' }}>
              <div className="modal-photo"><Photo c={pick} /></div>
              <h2>Yakin memilih nomor {pick.number}?</h2>
              <p style={{ margin: '10px 0 20px' }}>{pick.name}. Pilihan tidak dapat diubah.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn ghost" onClick={() => setPick(null)}>Batal</button>
                <button className="btn punch" onClick={submit}>Ya, kirim suara</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
export default function Page() { return <Suspense><Vote /></Suspense>; }