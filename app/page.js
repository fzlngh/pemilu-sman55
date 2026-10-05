'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [nisn, setNisn] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api('/login', { method: 'POST', body: { nisn } });
      sessionStorage.setItem('tok', r.token);
      router.push('/vote');
    } catch (x) {
      if (x.status === 423) router.push('/vote?blocked=1');
      else setErr(x.message);
    } finally { setBusy(false); }
  };
  return (
    <main className="home-page">
      <motion.img
        src="/depsis-2026-banner.png"
        alt="DEPSIS 2026"
        className="event-banner"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      />
      <div className="wrap hero">
        <motion.div
          className="hero-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <motion.img src="/logo-sman55.png" alt="Logo SMA Negeri 55 Jakarta" className="logo" style={{ marginBottom: 12 }}
            initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 100 }} />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontWeight: 700, marginBottom: 14 }}>
            Demokrasi Pimpinan OSIS · SMA Negeri 55 Jakarta
          </motion.p>
          <h1>
            {'The Starlit Voyage: Where Pegasus Leads'.split(' ').map((w, i) => (
              <motion.span key={i} style={{ display: 'inline-block', marginRight: '.25em' }}
                initial={{ y: 60, opacity: 0, rotate: 4 }} animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: i * 0.12, type: 'spring', stiffness: 120, damping: 14 }}>{w}</motion.span>
            ))}
          </h1>
          <motion.form className="login-form" onSubmit={submit} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            <input className="field" inputMode="numeric" maxLength={10} placeholder="NISN (10 digit)" value={nisn}
              onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))} aria-label="NISN" />
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} className="btn punch"
              style={{ marginTop: 14, width: '100%' }} disabled={nisn.length !== 10 || busy}>
              {busy ? 'Memeriksa…' : 'Masuk dan pilih'}
            </motion.button>
            {err && <motion.p animate={{ x: [0, -8, 8, -4, 0] }} className="err">{err}</motion.p>}
          </motion.form>
          <motion.p className="credit" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 1.4 }}>
            powered by{' '}
            <a href="https://dhiyaa-fazila.my.id/portofolio" target="_blank" rel="noopener noreferrer">Fazil.dev</a>
          </motion.p>
        </motion.div>
      </div>
    </main>
  );
}