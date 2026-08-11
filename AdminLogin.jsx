import { useState } from 'react';
import { supabase } from './supabase';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message || 'Login failed.');
      setBusy(false);
      return;
    }
    const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (adminError || !admin) {
      await supabase.auth.signOut();
      setError('This account is not authorized as an Atma Rekha admin.');
      setBusy(false);
      return;
    }
    onLoginSuccess?.();
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">Atma Rekha</p><h1 className="mt-2 text-3xl font-black">Admin access</h1><p className="mt-2 text-sm text-zinc-400">Sign in with the Supabase admin account.</p></div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium text-zinc-300">Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-blue-500" /></label>
          <label className="block text-sm font-medium text-zinc-300">Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-blue-500" /></label>
          {error && <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500 disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  );
}
