import { useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { AdminIcon } from './admin-redesign-ui.jsx';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      const role = await getAdminRole(data.user?.id);

      if (!role) {
        await supabase.auth.signOut();
        throw new Error('This account is not authorized as an Atma Rekha admin.');
      }

      onLoginSuccess?.();
    } catch (loginError) {
      setError(loginError?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-brand">
          <span className="admin-login-mark" aria-hidden="true">AR</span>
          <div>
            <p className="admin-login-kicker">ATMA REKHA · PRIVATE STUDIO</p>
            <span className="admin-login-brand-note">Publisher workspace</span>
          </div>
        </div>

        <h1 id="admin-login-title">Admin access</h1>
        <p>Sign in with the Supabase account authorized to manage Atma Rekha.</p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <label>
            Email
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              required
              inputMode="email"
            />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="admin-login-error" role="alert">
              <AdminIcon name="flag" size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="admin-login-submit"
            aria-busy={busy || undefined}
          >
            {busy ? <span className="admin-studio-button-loading-icon" aria-hidden="true" /> : null}
            <span>{busy ? 'Signing in…' : 'Enter admin studio'}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
