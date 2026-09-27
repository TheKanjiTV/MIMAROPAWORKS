import { useState } from 'react';
import { api } from '@/auth/api';
import { statusLabels, type Applicant, type ApplicationStatus } from '@/types/application';
import { Modal } from './Modal';

const date = (value: number) => new Date(Number(value)).toLocaleDateString();
const fairness =
  'Match scores are decision-support information based on the applicant profile and job requirements at the time of application. They should not be the sole basis for a hiring decision.';
const matchLabel = (score: number) =>
  score >= 90
    ? 'Excellent Match'
    : score >= 80
      ? 'Strong Match'
      : score >= 70
        ? 'Good Match'
        : 'Possible Match';

export function ApplicantReview({
  applicants,
  jobs,
  path,
  changed,
}: {
  applicants: Applicant[];
  jobs: { id: string; title: string }[];
  path: string;
  changed: () => Promise<void>;
}) {
  const [sort, setSort] = useState('newest'),
    [status, setStatus] = useState('all'),
    [jobFilter, setJobFilter] = useState('all');
  const [action, setAction] = useState<ApplicationStatus | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const jobId = path.startsWith('/employer/jobs/') ? path.split('/')[3] : null;
  const detailId = path.startsWith('/employer/applicants/') ? path.split('/')[3] : null;
  const applicant = applicants.find((a) => a.id === detailId);
  const job = jobs.find((j) => j.id === jobId);
  const resume = async (a: Applicant) => {
    setError('');
    setBusy(true);
    try {
      const response = await fetch(
        `/api/employer/applications/${encodeURIComponent(a.id)}/resume`,
        { credentials: 'same-origin' },
      );
      if (!response.ok)
        throw new Error(
          response.status === 403 ? 'Resume access denied.' : 'This resume is no longer available.',
        );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.resume.original_filename || 'resume.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage('Resume downloaded. Open the PDF from your downloads.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to download resume.');
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!applicant || !action) return;
    setBusy(true);
    setError('');
    try {
      await api(`/employer/applications/${applicant.id}/status`, { status: action });
      await changed();
      setMessage(`Application marked as ${statusLabels[action]}.`);
      setAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update application.');
    } finally {
      setBusy(false);
    }
  };
  if (detailId && !applicant)
    return (
      <section className="account-card">
        <h1>Applicant unavailable</h1>
        <p>This application is not available to your company.</p>
        <a href="/employer/applicants">Back to Applicants</a>
      </section>
    );
  if (jobId && !job)
    return (
      <section className="account-card">
        <h1>Job unavailable</h1>
        <p>This job is not available to your company.</p>
      </section>
    );
  const filtered = applicants
    .filter(
      (a) =>
        (!jobId || a.job_id === jobId) &&
        (status === 'all' || a.status === status) &&
        (jobFilter === 'all' || a.job_id === jobFilter),
    )
    .sort((a, b) =>
      sort === 'match'
        ? Number(b.match_score) - Number(a.match_score)
        : sort === 'oldest'
          ? a.applied_at - b.applied_at
          : b.applied_at - a.applied_at,
    );
  return (
    <>
      <p role="alert" className="auth-form-error">
        {error}
      </p>
      <p role="status">{message}</p>
      {applicant ? (
        <>
          <a href="/employer/applicants">Back to Applicants</a>
          <h1>{applicant.full_name}</h1>
          <p>
            {applicant.title} · Applied {date(applicant.applied_at)}
          </p>
          <p className="workspace-badge">{statusLabels[applicant.status]}</p>
          <section className="account-card">
            <h2>Applicant profile</h2>
            <dl className="workspace-details">
              {Object.entries({
                Location: [applicant.profile.municipality, applicant.profile.province]
                  .filter(Boolean)
                  .join(', '),
                Education: applicant.profile.education,
                'Course / Program': applicant.profile.course,
                Skills: applicant.profile.skills?.join(', '),
                'Recent Job Title': applicant.profile.recent_job_title,
                'Accepted resume experience': applicant.profile.experience_snippets?.join('\n'),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
            {applicant.resume.available ? (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void resume(applicant)}
              >
                View Resume
              </button>
            ) : (
              <p>No resume available.</p>
            )}
          </section>
          <section className="account-card">
            <h2>Application Match</h2>
            <p>{fairness}</p>
            <dl className="workspace-details">
              {Object.entries({
                'Overall Match': Number(applicant.match_score),
                'Semantic Similarity': Number(applicant.semantic_score) * 100,
                'Skills Match': Number(applicant.skills_score) * 100,
                'Location Match': Number(applicant.location_score) * 100,
                'Education Match': Number(applicant.education_score) * 100,
                'Experience Match': Number(applicant.experience_score) * 100,
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{Math.round(value)}%</dd>
                </div>
              ))}
            </dl>
            <h3>Matched Skills</h3>
            <p>{applicant.matched_skills.join(' · ') || 'None recorded'}</p>
            <h3>Missing Skills</h3>
            <p>{applicant.missing_skills.join(' · ') || 'None recorded'}</p>
          </section>
          <div className="account-form-actions">
            {applicant.status === 'submitted' && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => setAction('under_review')}
              >
                Mark as Under Review
              </button>
            )}
            {['submitted', 'under_review'].includes(applicant.status) && (
              <>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => setAction('shortlisted')}
                >
                  Shortlist
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => setAction('rejected')}
                >
                  Reject Application
                </button>
              </>
            )}
          </div>
          <Modal
            isOpen={!!action}
            onClose={() => !busy && setAction(null)}
            titleId="applicant-confirm"
            className="workspace-dialog"
          >
            <h2 id="applicant-confirm">
              {action === 'shortlisted'
                ? 'Shortlist this applicant?'
                : action === 'rejected'
                  ? 'Reject this application?'
                  : 'Mark as Under Review?'}
            </h2>
            <p>
              {action === 'shortlisted'
                ? 'The applicant will see that their application has progressed to Shortlisted.'
                : action === 'rejected'
                  ? 'The applicant will see Not Selected.'
                  : 'The applicant will see Under Review.'}
            </p>
            <p role="alert">{error}</p>
            <div className="account-form-actions">
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy
                  ? 'Saving…'
                  : action === 'shortlisted'
                    ? 'Shortlist'
                    : action === 'rejected'
                      ? 'Reject Application'
                      : 'Mark as Under Review'}
              </button>
            </div>
          </Modal>
        </>
      ) : (
        <>
          <h1>{job ? `${job.title} Applicants` : 'Applicants'}</h1>
          <p>{fairness}</p>
          <div className="workspace-form">
            <label className="account-field">
              <span>Sort applicants</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="match">Highest Match</option>
              </select>
            </label>
            <label className="account-field">
              <span>Application status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {!jobId && (
              <label className="account-field">
                <span>Job</span>
                <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
                  <option value="all">All Jobs</option>
                  {jobs.map((j) => (
                    <option value={j.id} key={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {filtered.map((a) => (
            <article className="account-card workspace-row" key={a.id}>
              <div>
                <h2>{a.full_name}</h2>
                <p>
                  {a.title} · {date(a.applied_at)}
                </p>
                <p>
                  {[
                    a.profile.municipality,
                    a.profile.province,
                    a.profile.education,
                    a.profile.recent_job_title,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p>{a.matched_skills.slice(0, 4).join(' · ')}</p>
                <p className="workspace-badge">{statusLabels[a.status]}</p>
              </div>
              <div>
                <p>
                  {a.match_score}% · {matchLabel(Number(a.match_score))}
                </p>
                <a className="button button-secondary" href={`/employer/applicants/${a.id}`}>
                  View Applicant
                </a>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <section className="account-card">
              <h2>
                {status !== 'all' || jobFilter !== 'all'
                  ? 'No applicants match this filter.'
                  : job
                    ? 'No applicants for this job yet.'
                    : 'No applications yet'}
              </h2>
              <p>Applications submitted to your job postings will appear here.</p>
            </section>
          )}
        </>
      )}
    </>
  );
}
