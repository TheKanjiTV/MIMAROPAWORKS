import { useState } from 'react';
import { Shield, User, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sendResetLink = async () => {
    if (!user?.email || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/forgot-password', { email: user.email });
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send reset instructions. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Account Settings</h1>
        <p className="text-sm text-slate-600">
          Manage your account credentials, login methods, and profile preferences.
        </p>
      </section>

      {/* Account Info */}
      <section className="sw-card p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <User size={18} className="text-[#176b61]" /> Account Information
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Full Name</span>
            <span className="font-semibold text-slate-900">{user?.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Email Address</span>
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              {user?.email}
              {user?.emailVerified && (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold">
                  Verified
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Sign-in Provider</span>
            <span className="font-semibold text-slate-900 capitalize">
              {user?.provider || 'Password'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Account Role</span>
            <span className="font-semibold text-slate-900">Job Seeker</span>
          </div>
        </div>
      </section>

      {/* Change Password (if using password auth) */}
      {user?.provider === 'password' && (
        <section className="sw-card p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield size={18} className="text-[#176b61]" /> Change Password
          </h2>

          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2"
            >
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2"
            >
              <CheckCircle2 size={15} /> {message}
            </div>
          )}

          <p className="text-sm text-slate-600">
            We will email reset instructions to {user.email}. Follow the secure link to choose a new
            password.
          </p>
          <button
            type="button"
            onClick={() => void sendResetLink()}
            disabled={busy}
            className="sw-btn sw-btn-primary sw-btn-sm"
          >
            {busy ? 'Sending reset link…' : 'Send password reset link'}
          </button>
        </section>
      )}

      {/* Sign Out */}
      <section className="sw-card p-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Sign Out</h3>
          <p className="text-xs text-slate-500">
            Sign out of your MIMAROPA Works session on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await signOut();
              navigate('/');
            } catch (err) {
              window.dispatchEvent(
                new CustomEvent('mimawork:toast', {
                  detail: {
                    message:
                      err instanceof Error ? err.message : 'Could not sign out. Please try again.',
                  },
                }),
              );
            }
          }}
          className="sw-btn sw-btn-secondary sw-btn-sm text-rose-600 hover:text-rose-700"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </section>
    </div>
  );
}
