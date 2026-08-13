import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const PLANS = [
  {
    id: 'supporter',
    icon: '🥇',
    name: 'Gold',
    price: '₹49',
    cadence: 'per month',
    description: 'Support me and the creation of Atma Rekha every month.',
    action: 'Support with ₹49/month',
  },
  {
    id: 'premium',
    icon: '💎',
    name: 'Diamond',
    price: '₹99',
    cadence: 'per month',
    description: 'Support me and Atma Rekha every month.',
    action: 'Support with ₹99/month',
  },
];

export default function Support({ onBack }) {
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data?.user || null);
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <button type="button" onClick={onBack} className="text-sm text-zinc-400 transition hover:text-white">
          ← Back to Atma Rekha
        </button>
        <span className="text-xs font-medium tracking-[0.25em] text-zinc-500">SUPPORT ME</span>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-20 pt-10 text-center sm:px-8 sm:pt-16">
        <p className="mb-4 text-xs font-semibold tracking-[0.3em] text-amber-400">ATMA REKHA</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Support me. Help me keep creating.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          Atma Rekha is still just getting started. If you enjoy the manga and want to support me,
          you can do so here. There is absolutely no pressure.
        </p>

        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-6 text-left sm:p-8">
          <p className="text-sm font-semibold text-amber-300">📖 Atma Rekha is free to read</p>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            All released chapters are free for members and non-members alike, at least for now.
            Membership is simply a way to support me and the creation of Atma Rekha. It does not unlock
            chapters, exclusive reading access, or any extra reading benefits.
          </p>
          <p className="mt-4 text-sm text-zinc-400">Thank you for supporting my work. ❤️</p>
        </div>

        <div className="mt-10 grid gap-5 text-left sm:grid-cols-2">
          {PLANS.map((plan) => {
            const active = selected === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(active ? null : plan.id)}
                className={`group rounded-3xl border p-6 text-left transition duration-300 sm:p-8 ${
                  active
                    ? 'border-amber-300/60 bg-white/[0.07]'
                    : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]'
                }`}
                aria-pressed={active}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-3xl" aria-hidden="true">{plan.icon}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Monthly support</span>
                </div>
                <h2 className="mt-6 text-2xl font-semibold">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-3xl">{plan.price}</strong>
                  <span className="text-sm text-zinc-500">/ month</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-400">{plan.description}</p>

                {active && (
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <p className="mb-3 text-xs text-zinc-500">
                      {user ? 'You are signed in. Payment will be handled securely on the server.' : 'Please sign in before continuing with support.'}
                    </p>
                    <span className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950">
                      {user ? plan.action : 'Login to continue'}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-xs leading-5 text-zinc-600">
          Your membership does not change your access to Atma Rekha. Every released chapter remains free to read.
        </p>
      </section>
    </main>
  );
}
