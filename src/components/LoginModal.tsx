import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, Eye, EyeOff, LoaderCircle, X } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/auth/api';
import { useAuthViewport } from '@/auth/useAuthViewport';
import { Modal } from '@/components/Modal';
import type { AuthMode, AuthResult, SignInReason } from '@/types/auth';
import './login-modal.css';

type Values = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agree: boolean;
  remember: boolean;
};
type Field = 'fullName' | 'email' | 'password' | 'confirmPassword' | 'agree';
const EMPTY: Values = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  agree: false,
  remember: false,
};
const TITLES = {
  login: 'Welcome back',
  register: 'Create your account',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};
const DESCRIPTIONS = {
  login: 'Log in to continue finding opportunities that match your skills and location.',
  register: 'Start building your profile and discover job opportunities that match your skills.',
  forgot: 'Enter the email connected to your account.',
  reset: 'Use a new password with at least 8 characters.',
};
const LEGAL_PAGES = [
  {
    title: 'Terms of Use',
    text: 'This InnoHack prototype creates a job seeker account. Provide accurate details and do not misuse other accounts. Job listings and match scores are samples. Applications, document submission, and AI matching are not yet available.',
  },
  {
    title: 'Privacy Policy: your account',
    text: 'We store your name, email, securely hashed password, and profile details on this app’s server. Google sign-in also stores your Google account ID and optional photo. Session cookies keep you signed in.',
  },
  {
    title: 'Privacy Policy: your data',
    text: 'Profile data is not sent to employers or an AI service in this prototype. Contact the project team for account or data removal. Google handles its own sign-in process.',
  },
];

export function AuthForm({
  initialMode = 'login',
  titleId,
  descriptionId,
  onSuccess,
  admin = false,
  token = '',
}: {
  initialMode?: AuthMode;
  titleId: string;
  descriptionId: string;
  onSuccess: (result: AuthResult) => void;
  admin?: boolean;
  token?: string;
}) {
  const { authenticate, completeGoogleSignIn, googleAvailable, googleStatus, loading, refresh } =
    useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const { compact, tight } = useAuthViewport();
  const [step, setStep] = useState(0);
  const [googleOnly, setGoogleOnly] = useState(false);
  const [legalPage, setLegalPage] = useState<number | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [googleWidth, setGoogleWidth] = useState(300);
  const googleRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const active = useRef(true);
  const id = useId();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!googleRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setGoogleWidth(Math.min(400, Math.max(200, Math.floor(entry.contentRect.width)))),
    );
    observer.observe(googleRef.current);
    return () => observer.disconnect();
  }, [mode, googleOnly, compact, step, legalPage]);
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setStep(0);
    setGoogleOnly(false);
    setLegalPage(null);
    setValues((v) => ({ ...EMPTY, email: v.email, fullName: v.fullName }));
    setTouched({});
    setVisible({ password: false, confirmPassword: false });
    setError('');
    setMessage('');
    requestAnimationFrame(() => document.getElementById(titleId)?.focus());
  };
  const fields: Field[] =
    mode === 'register'
      ? ['fullName', 'email', 'password', 'confirmPassword', 'agree']
      : mode === 'login'
        ? ['email', 'password']
        : mode === 'forgot'
          ? ['email']
          : ['password', 'confirmPassword'];
  const groups: Field[][] = googleOnly
    ? [mode === 'register' ? ['agree'] : []]
    : !compact
      ? [fields]
      : mode === 'register'
        ? tight
          ? [['fullName'], ['email'], ['password'], ['confirmPassword'], ['agree']]
          : [['fullName', 'email'], ['password', 'confirmPassword'], ['agree']]
        : tight && mode === 'login'
          ? [['email'], ['password']]
          : tight && mode === 'reset'
            ? [['password'], ['confirmPassword']]
            : [fields];
  const currentStep = Math.min(step, groups.length - 1);
  const shownFields = groups[currentStep];
  const lastStep = currentStep === groups.length - 1;
  const focusTitle = () => requestAnimationFrame(() => document.getElementById(titleId)?.focus());
  const validate = (field: Field): string => {
    if (field === 'fullName')
      return values.fullName.trim().length < 2 ? 'Please enter your full name.' : '';
    if (field === 'email')
      return !values.email.trim()
        ? 'Please enter your email address.'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
          ? 'Enter a valid email address.'
          : '';
    if (field === 'password')
      return !values.password
        ? 'Please enter your password.'
        : mode !== 'login' && values.password.length < 8
          ? 'Password must contain at least 8 characters.'
          : '';
    if (field === 'confirmPassword')
      return !values.confirmPassword
        ? 'Please confirm your password.'
        : values.password !== values.confirmPassword
          ? 'Passwords do not match.'
          : '';
    return values.agree ? '' : 'Please agree to the Terms of Use and Privacy Policy.';
  };
  const update = (field: keyof Values, value: string | boolean) => {
    setValues((v) => ({ ...v, [field]: value }));
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setTouched((previous) => ({
      ...previous,
      ...Object.fromEntries(shownFields.map((field) => [field, true])),
    }));
    if (shownFields.some((field) => validate(field))) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (!lastStep) {
      setStep(currentStep + 1);
      focusTitle();
      return;
    }
    const invalidGroup = groups.findIndex((group) => group.some((field) => validate(field)));
    if (invalidGroup >= 0) {
      setStep(invalidGroup);
      setTouched(Object.fromEntries(fields.map((field) => [field, true])));
      focusTitle();
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'forgot' || mode === 'reset') {
        const result = await api<{ message: string }>(
          mode === 'forgot' ? '/auth/forgot-password' : '/auth/reset-password',
          { ...values, token },
        );
        if (mode === 'reset') await refresh();
        if (active.current) {
          setMessage(result.message);
          setValues((v) => ({ ...v, password: '', confirmPassword: '' }));
          setTouched({});
        }
      } else {
        const result = await authenticate(admin ? 'admin/login' : mode, values);
        if (active.current) onSuccess(result);
      }
    } catch (err) {
      if (active.current)
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const input = (field: 'fullName' | 'email' | 'password' | 'confirmPassword', label: string) => {
    const isPassword = field === 'password' || field === 'confirmPassword';
    const errorText = touched[field] ? validate(field) : '';
    const helpId = `${id}-${field}-help`;
    return (
      <div className="auth-field" key={field}>
        <label htmlFor={`${id}-${field}`}>{label}</label>
        <div className="auth-input-wrap">
          <input
            id={`${id}-${field}`}
            name={field}
            value={values[field]}
            disabled={busy}
            type={
              isPassword
                ? visible[field]
                  ? 'text'
                  : 'password'
                : field === 'email'
                  ? 'email'
                  : 'text'
            }
            autoComplete={
              field === 'fullName'
                ? 'name'
                : field === 'email'
                  ? 'email'
                  : mode === 'login'
                    ? 'current-password'
                    : 'new-password'
            }
            maxLength={field === 'email' ? 254 : isPassword ? 128 : 100}
            required
            aria-invalid={Boolean(errorText)}
            aria-describedby={
              errorText || (field === 'password' && mode !== 'login') ? helpId : undefined
            }
            onChange={(event) => update(field, event.target.value)}
            onBlur={() => setTouched((v) => ({ ...v, [field]: true }))}
          />
          {isPassword && (
            <button
              type="button"
              className="auth-reveal icon-button"
              disabled={busy}
              aria-label={`${visible[field] ? 'Hide' : 'Show'} ${field === 'confirmPassword' ? 'confirm password' : 'password'}`}
              aria-pressed={visible[field]}
              onClick={() => setVisible((v) => ({ ...v, [field]: !v[field] }))}
            >
              {visible[field] ? (
                <EyeOff size={19} aria-hidden="true" />
              ) : (
                <Eye size={19} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
        <p id={helpId} className={errorText ? 'auth-field-error' : 'auth-hint'} aria-live="polite">
          {errorText ||
            (field === 'password' && mode !== 'login'
              ? 'At least 8 characters. Up to 128 characters.'
              : '')}
        </p>
      </div>
    );
  };
  if (legalPage !== null)
    return (
      <div className="login-content auth-legal-page">
        <p className="auth-brand">MIMAROPA WORKS</p>
        <h2 id={titleId} tabIndex={-1}>
          {LEGAL_PAGES[legalPage].title}
        </h2>
        <p id={descriptionId} className="auth-legal-copy">
          {LEGAL_PAGES[legalPage].text}
        </p>
        <p className="auth-step-note">
          Page {legalPage + 1} of {LEGAL_PAGES.length}
        </p>
        <div className="auth-step-actions">
          {legalPage > 0 && (
            <button
              className="button button-secondary"
              onClick={() => {
                setLegalPage(legalPage - 1);
                focusTitle();
              }}
            >
              Previous
            </button>
          )}
          {legalPage < LEGAL_PAGES.length - 1 && (
            <button
              className="button button-primary"
              onClick={() => {
                setLegalPage(legalPage + 1);
                focusTitle();
              }}
            >
              Next
            </button>
          )}
          <button
            className="auth-text-button"
            onClick={() => {
              setLegalPage(null);
              focusTitle();
            }}
          >
            Back to form
          </button>
        </div>
      </div>
    );
  return (
    <div
      className={`login-content ${compact ? 'auth-compact' : ''} ${tight ? 'auth-tight' : ''}`}
      data-mode={mode}
      data-google-only={googleOnly}
    >
      <p className="auth-brand">MIMAROPA WORKS{admin ? ' · ADMIN' : ''}</p>
      {!admin && (mode === 'login' || mode === 'register') && (
        <div className="auth-mode" aria-label="Account access">
          <button
            type="button"
            aria-pressed={mode === 'login'}
            disabled={busy}
            onClick={() => switchMode('login')}
          >
            Log In
          </button>
          <button
            type="button"
            aria-pressed={mode === 'register'}
            disabled={busy}
            onClick={() => switchMode('register')}
          >
            Create Account
          </button>
        </div>
      )}
      <h2 id={titleId} tabIndex={-1}>
        {googleOnly
          ? 'Continue with Google'
          : admin && mode === 'login'
            ? 'Administrator login'
            : TITLES[mode]}
      </h2>
      <p id={descriptionId} className="login-description">
        {admin && mode === 'login'
          ? 'Sign in with your administrator account.'
          : DESCRIPTIONS[mode]}
      </p>
      {groups.length > 1 && (
        <p className="auth-step-note" aria-live="polite">
          Step {currentStep + 1} of {groups.length} ·{' '}
          {shownFields.includes('agree')
            ? 'Review and agree'
            : shownFields.includes('password') || shownFields.includes('confirmPassword')
              ? 'Secure your account'
              : 'Your account details'}
        </p>
      )}
      <form ref={formRef} noValidate onSubmit={submit} className="auth-form" aria-busy={busy}>
        {shownFields.includes('fullName') && input('fullName', 'Full Name')}
        {shownFields.includes('email') && input('email', 'Email Address')}
        {shownFields.includes('password') && input('password', 'Password')}
        {shownFields.includes('confirmPassword') && input('confirmPassword', 'Confirm Password')}
        {shownFields.includes('agree') && (
          <div className="auth-consent">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={values.agree}
                disabled={busy}
                aria-invalid={Boolean(touched.agree && validate('agree'))}
                aria-describedby={
                  touched.agree && validate('agree') ? `${id}-agree-error` : undefined
                }
                onChange={(event) => {
                  update('agree', event.target.checked);
                  setTouched((v) => ({ ...v, agree: true }));
                }}
              />
              <span>I agree to the Terms of Use and Privacy Policy.</span>
            </label>
            <p className="auth-field-error" id={`${id}-agree-error`} aria-live="polite">
              {touched.agree && validate('agree')}
            </p>
            <button
              type="button"
              className="auth-text-button auth-legal-link"
              onClick={() => {
                setLegalPage(0);
                focusTitle();
              }}
            >
              Read Terms of Use and Privacy Policy
            </button>
          </div>
        )}
        {mode === 'login' && shownFields.includes('password') && (
          <div className="auth-options">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={values.remember}
                disabled={busy}
                onChange={(event) => update('remember', event.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <button
              className="auth-text-button"
              type="button"
              disabled={busy}
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
          </div>
        )}
        <div role="alert" className="auth-form-error">
          {error}
        </div>
        <div role="status" className={`auth-success ${busy ? 'sr-only' : ''}`}>
          {busy ? 'Please wait…' : message}
        </div>
        <div className="auth-navigation">
          {!googleOnly && !((mode === 'forgot' || mode === 'reset') && message) && (
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy || loading}
            >
              {busy && <LoaderCircle size={18} className="auth-spinner" aria-hidden="true" />}
              {!lastStep
                ? 'Continue'
                : mode === 'register'
                  ? 'Create Account'
                  : mode === 'forgot'
                    ? 'Send Reset Link'
                    : mode === 'reset'
                      ? 'Save New Password'
                      : 'Log In'}
            </button>
          )}
          {currentStep > 0 && (
            <button
              type="button"
              className="auth-text-button auth-step-back"
              disabled={busy}
              onClick={() => {
                setStep(currentStep - 1);
                setError('');
                focusTitle();
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
        </div>
      </form>
      {!admin &&
        (mode === 'login' || mode === 'register') &&
        (!compact || currentStep === 0 || googleOnly) && (
          <>
            <div className="auth-separator">
              <span>or</span>
            </div>
            {compact && !googleOnly ? (
              <button
                className="button button-secondary auth-google-choice"
                type="button"
                disabled={busy}
                onClick={() => {
                  setGoogleOnly(true);
                  setStep(0);
                  setError('');
                  focusTitle();
                }}
              >
                Use Google instead
              </button>
            ) : (
              <>
                <div className="google-button-container" ref={googleRef} aria-busy={busy}>
                  {googleAvailable && !busy ? (
                    <GoogleLogin
                      onSuccess={async (response) => {
                        if (!active.current) return;
                        if (mode === 'register' && !values.agree) {
                          setTouched((v) => ({ ...v, agree: true }));
                          setError('Please agree to the Terms of Use and Privacy Policy first.');
                          return;
                        }
                        setBusy(true);
                        setError('');
                        try {
                          const result = await completeGoogleSignIn(
                            response,
                            values.agree,
                            values.remember,
                          );
                          if (active.current) onSuccess(result);
                        } catch (err) {
                          if (active.current)
                            setError(
                              err instanceof Error ? err.message : 'Google sign-in did not finish.',
                            );
                        } finally {
                          if (active.current) setBusy(false);
                        }
                      }}
                      onError={() =>
                        setError(
                          'Google sign-in did not finish. Please try again or use your email.',
                        )
                      }
                      text="continue_with"
                      theme="outline"
                      size="large"
                      shape="rectangular"
                      width={googleWidth}
                      useOneTap={false}
                      auto_select={false}
                      ux_mode="popup"
                    />
                  ) : (
                    <button type="button" className="button button-secondary" disabled>
                      Continue with Google
                    </button>
                  )}
                </div>
                {!googleAvailable && (
                  <p className="auth-hint">
                    {googleStatus === 'loading'
                      ? 'Loading Google sign-in…'
                      : 'Google sign-in is unavailable. You can use your email.'}
                  </p>
                )}
              </>
            )}
            {googleOnly && (
              <button
                type="button"
                className="auth-text-button"
                onClick={() => {
                  setGoogleOnly(false);
                  setStep(0);
                  setError('');
                  focusTitle();
                }}
              >
                Use email instead
              </button>
            )}
            <p className="login-register">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                className="auth-text-button"
                disabled={busy}
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Create account' : 'Log in'}
              </button>
            </p>
          </>
        )}
      {(mode === 'forgot' || mode === 'reset') && (
        <button
          type="button"
          className="auth-text-button"
          disabled={busy}
          onClick={() => switchMode('login')}
        >
          <ArrowLeft size={16} /> Back to Log In
        </button>
      )}
    </div>
  );
}

export function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: AuthResult) => void;
  initialMode?: AuthMode;
  reason?: SignInReason;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId={titleId}
      descriptionId={descriptionId}
      className="login-modal"
    >
      <button
        type="button"
        className="login-close icon-button"
        onClick={onClose}
        aria-label="Close authentication"
        data-modal-close
      >
        <X size={22} aria-hidden="true" />
      </button>
      {isOpen && (
        <AuthForm
          initialMode={initialMode}
          titleId={titleId}
          descriptionId={descriptionId}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}
