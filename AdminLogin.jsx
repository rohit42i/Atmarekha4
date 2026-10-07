import { useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { validateEmail } from './formUX.js';

export default function AdminLogin({ onLoginSuccess }) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [fieldError,setFieldError]=useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const emailCheck=validateEmail(email);
    if(!emailCheck.ok){setFieldError(emailCheck.message);setError('Please correct the highlighted field.');return}
    if(!password){setFieldError('Password is required.');setError('Please enter your password.');return}
    setFieldError('');setError('');setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      const role = await getAdminRole(data.user?.id);
      if (!role) {
        await supabase.auth.signOut();
        throw new Error('This account is not authorized as an Atma Rekha admin.');
      }
      onLoginSuccess?.();
    } catch (loginError) {
      setError(loginError?.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className="admin-login-page min-h-screen px-5 py-12 text-[var(--text-color)]">
    <div className="admin-login-card mx-auto max-w-md rounded-3xl p-7 sm:p-9">
      <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">Atma Rekha</p><h1 className="mt-2 text-3xl font-black">Admin access</h1><p className="mt-2 text-sm text-zinc-400">Sign in with the Supabase admin account.</p></div>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <label className="block text-sm font-medium text-zinc-300">Email<input value={email} onChange={e=>{setEmail(e.target.value);setFieldError('');setError('')}} onBlur={()=>{const check=validateEmail(email);if(email&&!check.ok)setFieldError(check.message)}} type="email" autoComplete="username" required aria-invalid={Boolean(fieldError)} aria-describedby={fieldError?'admin-login-error':undefined} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-blue-500" />{fieldError&&<span id="admin-login-error" className="form-field-error">{fieldError}</span>}</label>
        <label className="block text-sm font-medium text-zinc-300">Password<div className="input-with-action"><input value={password} onChange={e=>{setPassword(e.target.value);setError('')}} type={showPassword?'text':'password'} autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-blue-500" /><button type="button" className="input-action-button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?'Hide':'Show'}</button></div></label>
        {error && <div className="form-field-error" role="alert">{error}</div>}
        <button disabled={busy} type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500 disabled:opacity-50">{busy?<><span className="button-spinner" aria-hidden="true"/> Please wait…</>:'Sign in'}</button>
      </form>
    </div>
  </main>;
}
