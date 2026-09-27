import { useState, useEffect } from 'react';
import {
  Clock,
  Briefcase,
  MapPin,
  MessageSquare,
  Sparkles,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { Modal } from '@/components/Modal';
import { statusLabels, type Application, type ApplicationStatus } from '@/types/application';

type ApplicationRecord = Application & {
  job_id: string;
  updated_at: number;
  job_status?: string;
  application_deadline?: number | null;
};

const date = (value: number) =>
  new Date(Number(value)).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const statusColors: Record<ApplicationStatus, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  withdrawn: 'bg-slate-100 text-slate-600 border-slate-200',
};

// Application Timeline component
function ApplicationTimeline({ status }: { status: ApplicationStatus }) {
  const steps = [
    { id: 'submitted', label: 'Submitted' },
    { id: 'received', label: 'Received' },
    { id: 'under_review', label: 'Review' },
    { id: 'shortlisted', label: 'Interview' },
    { id: 'final', label: 'Decision' },
  ];

  const getStepState = (stepId: string) => {
    if (status === 'withdrawn') return 'withdrawn';
    if (status === 'rejected') return stepId === 'final' ? 'rejected' : 'done';

    if (stepId === 'submitted') return 'done';
    if (stepId === 'received') return status !== 'submitted' ? 'done' : 'current';
    if (stepId === 'under_review') {
      if (['under_review', 'shortlisted'].includes(status))
        return status === 'under_review' ? 'current' : 'done';
      return 'pending';
    }
    if (stepId === 'shortlisted') {
      return status === 'shortlisted' ? 'current' : 'pending';
    }
    return 'pending';
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2 w-full max-w-md my-2">
      {steps.map((s, idx) => {
        const state = getStepState(s.id);
        const isDone = state === 'done';
        const isCurrent = state === 'current';
        const isRejected = state === 'rejected';

        return (
          <div key={s.id} className="flex-1 flex items-center">
            <div className="flex flex-col items-center w-full">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                  isDone
                    ? 'bg-[#176b61] text-white'
                    : isCurrent
                      ? 'bg-teal-100 border-2 border-[#176b61] text-[#176b61]'
                      : isRejected
                        ? 'bg-rose-100 border-2 border-rose-600 text-rose-600'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {isDone ? <Check size={11} /> : isRejected ? <X size={11} /> : idx + 1}
              </div>
              <span
                className={`text-[10px] mt-1 whitespace-nowrap hidden sm:block ${
                  isCurrent || isDone ? 'font-semibold text-slate-800' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 ${isDone ? 'bg-[#176b61]' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ApplicationsPage({ path }: { path: string }) {
  const [items, setItems] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Selected Detail Modal / View
  const detailId = path.split('/')[2];
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadApplications = async () => {
    try {
      const res = await api<{ applications: ApplicationRecord[] }>('/applications');
      setItems(res.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api<{ applications: ApplicationRecord[] }>('/applications')
      .then((res) => {
        if (active) setItems(res.applications);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleMessageEmployer = async (appId: string) => {
    try {
      const result = await api<{ conversation: { id: string } }>('/conversations', {
        application_id: appId,
      });
      window.dispatchEvent(new Event('mimawork:updates'));
      navigate(`/messages?conversation=${encodeURIComponent(result.conversation.id)}`);
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: {
            message: err instanceof Error ? err.message : 'Could not open conversation.',
          },
        }),
      );
    }
  };

  const handleWithdraw = async (appId: string) => {
    setBusy(true);
    try {
      await api(`/applications/${encodeURIComponent(appId)}/withdraw`, {});
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: 'Application withdrawn successfully.' },
        }),
      );
      setWithdrawModalOpen(false);
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw application.');
    } finally {
      setBusy(false);
    }
  };

  // Filtered applications
  const filteredApps = items.filter((item) => {
    if (activeFilter !== 'all') {
      if (activeFilter === 'interview') {
        if (item.status !== 'shortlisted') return false;
      } else if (item.status !== activeFilter) {
        return false;
      }
    }
    return true;
  });

  const activeAppDetail = detailId ? items.find((a) => a.id === detailId) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">My Applications</h1>
        <p className="text-sm text-slate-500">
          Track the progress of your submissions, interview invitations, and employer
          communications.
        </p>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 mt-5 border-b border-slate-100 pb-3 overflow-x-auto">
          {[
            { id: 'all', label: `All (${items.length})` },
            { id: 'submitted', label: 'Applied' },
            { id: 'under_review', label: 'Under Review' },
            { id: 'interview', label: 'Interview' },
            { id: 'rejected', label: 'Not Selected' },
            { id: 'withdrawn', label: 'Withdrawn' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === tab.id
                  ? 'bg-[#176b61] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="sw-skeleton-card">
              <div className="sw-skeleton h-5 w-1/3" />
              <div className="sw-skeleton h-4 w-1/4" />
              <div className="sw-skeleton h-12 w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="sw-card text-center py-16 px-6">
          <Briefcase size={44} className="mx-auto text-slate-400 mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">No applications yet</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
            Start exploring verified opportunities that match your profile and take the first step
            in your career.
          </p>
          <button type="button" onClick={() => navigate('/jobs')} className="sw-btn sw-btn-primary">
            Browse Jobs
          </button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="sw-card text-center py-10">
          <p className="text-sm text-slate-500">No applications match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const statusLabel = statusLabels[app.status] || app.status;
            const badgeClass = statusColors[app.status] || 'bg-slate-100 text-slate-600';

            return (
              <article key={app.id} className="sw-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{app.title}</h2>
                    <p className="text-sm font-semibold text-slate-700">{app.company_name}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-400" />
                        {app.municipality}, {app.province}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-slate-400" />
                        Applied on {date(app.applied_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}`}
                    >
                      {statusLabel}
                    </span>
                    {app.match_score !== undefined && (
                      <span className="sw-badge sw-badge-match">
                        <Sparkles size={12} /> {app.match_score}% Match
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Application Status Timeline
                  </span>
                  <ApplicationTimeline status={app.status} />
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleMessageEmployer(app.id)}
                      className="sw-btn sw-btn-secondary sw-btn-sm"
                    >
                      <MessageSquare size={14} /> Message Employer
                    </button>
                    {['submitted', 'under_review', 'shortlisted'].includes(app.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApp(app);
                          setWithdrawModalOpen(true);
                        }}
                        className="text-xs text-slate-400 hover:text-rose-600 font-medium px-2 py-1"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/jobs/${app.job_id || app.id}`)}
                      className="sw-btn sw-btn-secondary sw-btn-sm"
                    >
                      View Job Listing
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/applications/${app.id}`)}
                      className="sw-btn sw-btn-primary sw-btn-sm"
                    >
                      Application Details →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Application Detail View if route is /applications/:id */}
      {activeAppDetail && (
        <Modal
          isOpen={Boolean(activeAppDetail)}
          onClose={() => navigate('/applications')}
          titleId="detail-title"
          descriptionId="detail-desc"
          className="max-w-lg p-6 space-y-4"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-[#176b61] uppercase tracking-wider">
                Application Details
              </span>
              <h2 id="detail-title" className="text-lg font-bold text-slate-900">
                {activeAppDetail.title}
              </h2>
              <p className="text-sm text-slate-600">{activeAppDetail.company_name}</p>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              onClick={() => navigate('/applications')}
              data-modal-close
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted:</span>
              <span className="font-semibold text-slate-800">
                {date(activeAppDetail.applied_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Location:</span>
              <span className="font-semibold text-slate-800">
                {activeAppDetail.municipality}, {activeAppDetail.province}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Submission Match:</span>
              <span className="font-semibold text-emerald-700">
                {activeAppDetail.match_score}% Profile Match
              </span>
            </div>
          </div>

          {activeAppDetail.matched_skills && activeAppDetail.matched_skills.length > 0 && (
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1.5">Matched Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {activeAppDetail.matched_skills.map((s) => (
                  <span key={s} className="sw-chip sw-chip-matched">
                    <Check size={12} /> {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => void handleMessageEmployer(activeAppDetail.id)}
              className="sw-btn sw-btn-secondary sw-btn-sm"
            >
              <MessageSquare size={14} /> Message Employer
            </button>
            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="sw-btn sw-btn-primary sw-btn-sm"
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* Withdraw Modal */}
      {selectedApp && (
        <Modal
          isOpen={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          titleId="withdraw-title"
          descriptionId="withdraw-desc"
          className="max-w-md p-6"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <AlertCircle size={22} />
          </div>
          <h2 id="withdraw-title" className="text-lg font-bold text-slate-900 mb-1">
            Withdraw Application?
          </h2>
          <p id="withdraw-desc" className="text-xs text-slate-600 leading-relaxed mb-4">
            Are you sure you want to withdraw your application for{' '}
            <strong>{selectedApp.title}</strong> at <strong>{selectedApp.company_name}</strong>? You
            will no longer be considered for this opening.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="sw-btn sw-btn-secondary sw-btn-sm"
              onClick={() => setWithdrawModalOpen(false)}
              disabled={busy}
            >
              Keep Application
            </button>
            <button
              type="button"
              className="sw-btn bg-rose-600 hover:bg-rose-700 text-white sw-btn-sm"
              onClick={() => void handleWithdraw(selectedApp.id)}
              disabled={busy}
            >
              {busy ? 'Withdrawing…' : 'Withdraw Application'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
