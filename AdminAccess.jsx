import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';

export default function AdminAccess({ onClose }) {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');

  const verifyAdmin = async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return false;
    }

    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Admin verification failed:', error);
      setMessage('Unable to verify admin access.');
      setIsAdmin(false);
      return false;
    }

    const allowed = Boolean(data);
    setIsAdmin(allowed);
    if (!allowed) {
      await supabase.auth.signOut();
      setMessage('This account does not have admin access.');
    }
    return allowed;
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      if (user) await verifyAdmin(user.id);
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleLoginSuccess = async (data) => {
    const allowed = await verifyAdmin(data.session?.user?.id);
    if (!allowed) setMessage('Login succeeded, but this account is not an admin.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  if (checking) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
        <div className="rounded-2xl bg-white px-6 py-5 shadow-xl dark:bg-zinc-900">Checking admin access…</div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="fixed inset-0 z-[2000] overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200/70 bg-white/80 px-6 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">Atma Rekha Admin</span>
          <div className="flex gap-2">
            <button onClick={handleLogout} className="rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Logout</button>
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800">Close</button>
          </div>
        </div>
        <AdminPanel onBack={onClose} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto bg-zinc-50/95 backdrop-blur-sm dark:bg-zinc-950/95">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <button onClick={onClose} className="mb-4 rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">← Back to website</button>
        {message && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{message}</div>}
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
}
