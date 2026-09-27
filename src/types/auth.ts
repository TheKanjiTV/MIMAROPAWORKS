export type AuthUser = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: 'job_seeker' | 'employer' | 'admin';
  roleSelected: boolean;
  emailVerified: boolean;
  profileCompletion: number;
  provider: string;
};

export type AuthResult = { user: AuthUser; csrf: string; redirect: string };
export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export type GoogleStatus = 'unconfigured' | 'loading' | 'ready' | 'error';
export type SignInReason = 'save' | 'apply' | 'match' | 'signin';
