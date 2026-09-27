import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { AuthContext } from '@/auth/context';
import { api } from '@/auth/api';
import type { AuthResult, AuthUser, GoogleStatus } from '@/types/auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const refresh = async () => {
    try {
      const result = await api<{ user: AuthUser | null }>('/auth/session');
      setUser(result.user);
      setSessionError('');
      return result.user;
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to load your session.');
      return null;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    api<{ user: AuthUser | null }>('/auth/session')
      .then((result) => {
        if (active) {
          setUser(result.user);
          setSessionError('');
        }
      })
      .catch((error) => {
        if (active) setSessionError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>(
    GOOGLE_CLIENT_ID ? 'loading' : 'unconfigured',
  );

  useEffect(() => {
    if (googleStatus !== 'loading') return;
    const timer = window.setTimeout(() => setGoogleStatus('error'), 15000);
    return () => window.clearTimeout(timer);
  }, [googleStatus]);

  const completeGoogleSignIn = async (
    response: CredentialResponse,
    agree = false,
    remember = false,
    linkingPassword = '',
  ) => {
    if (!GOOGLE_CLIENT_ID || !response.credential) {
      throw new Error('Google sign-in did not finish. Please try again.');
    }
    const result = await api<AuthResult>('/auth/google', {
      credential: response.credential,
      agree,
      remember,
      linkingPassword,
    });
    setUser(result.user);
    return result;
  };

  const authenticate = async (mode: 'login' | 'register' | 'admin/login', data: unknown) => {
    const result = await api<AuthResult>(`/auth/${mode}`, data);
    setUser(result.user);
    return result;
  };

  const signOut = async () => {
    await api('/auth/logout', {});
    setUser(null);
    if (googleStatus === 'ready') googleLogout();
  };

  const content = (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionError,
        refresh,
        authenticate,
        googleAvailable: googleStatus === 'ready',
        googleStatus,
        completeGoogleSignIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

  if (!GOOGLE_CLIENT_ID) return content;

  return (
    <GoogleOAuthProvider
      clientId={GOOGLE_CLIENT_ID}
      locale="en"
      onScriptLoadSuccess={() => setGoogleStatus('ready')}
      onScriptLoadError={() => setGoogleStatus('error')}
    >
      {content}
    </GoogleOAuthProvider>
  );
}
