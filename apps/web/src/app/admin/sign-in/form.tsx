'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (signInError) {
      setError('That email and password did not match.');
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--text-primary)',
    font: 'inherit',
    marginBottom: 12,
  };

  return (
    <form onSubmit={submit}>
      <label className="small" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        style={inputStyle}
      />

      <label className="small" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        style={inputStyle}
      />

      {error ? (
        <p className="small" style={{ color: '#b4553c' }}>
          {error}
        </p>
      ) : null}

      <button type="submit" className="button" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
