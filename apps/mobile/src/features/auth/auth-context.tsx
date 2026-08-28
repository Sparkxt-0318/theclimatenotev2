/**
 * Auth state for the whole app.
 *
 * The app is usable signed out, so `session === null` is a normal operating
 * state and not an error to recover from. Screens ask for a session only at the
 * moment a reader tries to save something.
 */

import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the stored session has been read from the keychain. */
  initialising: boolean;
  isSignedIn: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthState>({
  session: null,
  initialising: true,
  isSignedIn: false,
  userId: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .finally(() => {
        // Whatever happened, stop blocking the UI. A reader who cannot restore
        // a session should still land on the articles.
        if (active) setInitialising(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      initialising,
      isSignedIn: session !== null,
      userId: session?.user.id ?? null,
    }),
    [session, initialising],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
