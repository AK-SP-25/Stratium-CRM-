import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import App from './App';

// Gates the whole CRM behind a Supabase session. There is deliberately no
// public sign-up screen — you create your own account once, directly in the
// Supabase dashboard (see the README), so no one else can register.
export default function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: '#F1F3F7', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'Inter,-apple-system,sans-serif', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return session ? <App /> : <Login />;
}
