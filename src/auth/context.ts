import { createContext } from 'react';
import type { CredentialResponse } from '@react-oauth/google';
import type { AuthResult, AuthUser, GoogleStatus } from '@/types/auth';

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  sessionError: string;
  googleAvailable: boolean;
  googleStatus: GoogleStatus;
  completeGoogleSignIn: (
    response: CredentialResponse,
    agree?: boolean,
    remember?: boolean,
    linkingPassword?: string,
  ) => Promise<AuthResult>;
  authenticate: (mode: 'login' | 'register' | 'admin/login', data: unknown) => Promise<AuthResult>;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
