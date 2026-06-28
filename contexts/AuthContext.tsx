import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Auth] Initializing auth session');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Session loaded:', session ? 'authenticated' : 'unauthenticated');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] Auth state changed:', _event, session ? 'authenticated' : 'unauthenticated');
      setSession(session);
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[Auth] Sign in attempt for:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log('[Auth] Sign in error:', error.message);
    } else {
      console.log('[Auth] Sign in successful');
    }
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    console.log('[Auth] Sign up attempt for:', email);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.log('[Auth] Sign up error:', error.message);
    } else {
      console.log('[Auth] Sign up successful');
    }
    return { error };
  };

  const signOut = async () => {
    console.log('[Auth] Signing out');
    await supabase.auth.signOut();
    console.log('[Auth] Signed out');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
