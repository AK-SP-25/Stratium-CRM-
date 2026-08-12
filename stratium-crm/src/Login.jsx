import { useState } from 'react';
import { supabase } from './supabaseClient';

const P = { bg: '#F1F3F7', wh: '#FFFFFF', bo: '#E2E8F0', ac: '#C4857A', tx: '#0F172A', ts: '#64748B', rd: '#EF4444' };

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  };

  return (
    <div style={{ background: P.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,-apple-system,sans-serif' }}>
      <form onSubmit={submit} style={{ background: P.wh, border: `1px solid ${P.bo}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '2.5px', color: P.ac, marginBottom: 2 }}>STRATIUM</div>
        <div style={{ fontSize: 11, color: P.ts, letterSpacing: '2px', marginBottom: 24 }}>BD CRM</div>
        <div style={{ fontSize: 11, color: P.ts, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>Email</div>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${P.bo}`, marginBottom: 14, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
        />
        <div style={{ fontSize: 11, color: P.ts, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>Password</div>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${P.bo}`, marginBottom: 18, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
        />
        {err && <div style={{ color: P.rd, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <button
          type="submit"
          disabled={busy}
          style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: P.ac, color: '#fff', fontWeight: 600, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
