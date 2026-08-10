import { useState } from 'react';
import { supabase } from './supabase';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Signing in...' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus({ type: 'error', message: error.message || 'Login failed.' });
      return;
    }

    setStatus({ type: 'success', message: 'Login successful. Welcome, Admin!' });
    onLoginSuccess?.(data);
  };

  return (
    <main className="min-h-[70vh] px-6 pt-28">
      <div className="mx-auto max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Admin Login</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with your Supabase admin account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required />
          </div>

          <button type="submit" disabled={status.type === 'loading'} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-white dark:text-black">
            {status.type === 'loading' ? 'Signing in…' : 'Login'}
          </button>
        </form>

        {status.message && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : status.type === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
            {status.message}
          </div>
        )}
      </div>
    </main>
  );
}
