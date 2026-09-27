import { ApplicantReview } from './ApplicantReview';
import type { Applicant } from '@/types/application';
import { useEffect, useState } from 'react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { useAuth } from '@/auth/useAuth';
import { Brand } from './Brand';
import { Modal } from './Modal';
import './account-page.css';
import './employer-workspace.css';

type Company = {
  user_id: string;
  company_name: string;
  industry: string;
  description: string;
  province: string;
  municipality: string;
  address: string;
  company_size: string;
  contact_person: string;
  contact_position: string;
  business_email: string;
  contact_number: string;
  website: string;
  verification_status: string;
  verification_reason: string;
  updated_at: number;
};
type Job = {
  id: string;
  title: string;
  description: string;
  industry: string;
  province: string;
  municipality: string;
  employment_type: string;
  work_setup: string;
  salary_min: number | null;
  salary_max: number | null;
  vacancies: number;
  education_required: string;
  experience_required: number;
  required_skills: string[] | string;
  preferred_skills: string[] | string;
  application_deadline: number | null;
  created_at: number;
  status: string;
};
type Document = {
  id: string;
  original_filename: string;
  document_type: string;
  file_size: number;
  uploaded_at: number;
};
const skills = (value: string[] | string) =>
  Array.isArray(value) ? value : (JSON.parse(value || '[]') as string[]);
const date = (value: number | null) =>
  value ? new Date(Number(value)).toLocaleDateString() : 'Not specified';
const provinces = ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'];
const suggestions = [
  'Canva',
  'Social Media Management',
  'Customer Service',
  'Communication',
  'Microsoft Excel',
  'Microsoft Office',
  'Bookkeeping',
  'Python',
  'JavaScript',
];

function SkillInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [entry, setEntry] = useState('');
  const add = (item = entry) => {
    const text = item.trim();
    if (text && !value.some((v) => v.toLowerCase() === text.toLowerCase()))
      onChange([...value, text]);
    setEntry('');
  };
  return (
    <div className="workspace-skills">
      <label className="account-field">
        <span>{label}</span>
        <input
          maxLength={80}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      </label>
      <button type="button" className="auth-text-button" onClick={() => add()}>
        Add skill
      </button>
      <div className="skill-chips">
        {value.map((item) => (
          <button
            type="button"
            key={item}
            aria-label={`Remove ${item}`}
            onClick={() => onChange(value.filter((v) => v !== item))}
          >
            {item} ×
          </button>
        ))}
      </div>
      <div className="skill-suggestions">
        {suggestions
          .filter((s) => !value.includes(s) && s.toLowerCase().includes(entry.toLowerCase()))
          .slice(0, 4)
          .map((s) => (
            <button type="button" className="auth-text-button" key={s} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
      </div>
    </div>
  );
}

export function EmployerWorkspace({ path }: { path: string }) {
  const { user, loading, sessionError, signOut } = useAuth();
  const admin = path.startsWith('/admin');
  const [company, setCompany] = useState<Company | null>(null),
    [jobs, setJobs] = useState<Job[]>([]),
    [applicants, setApplicants] = useState<Applicant[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const allowed = user?.role === (admin ? 'admin' : 'employer');
  useEffect(() => {
    if (!loading && !sessionError && !user) navigate(admin ? '/admin/login' : '/login');
  }, [loading, sessionError, user, admin]);
  const reload = async () => {
    const [p, j, a] = await Promise.all([
      api<{ profile: Company | null }>('/employer/profile'),
      api<{ jobs: Job[] }>('/employer/jobs'), api<{applications:Applicant[]}>('/employer/applicants'),
    ]);
    setCompany(p.profile);
    setJobs(j.jobs);
    setApplicants(a.applications); setReady(true);
    if (!p.profile) navigate('/onboarding/employer');
  };
  useEffect(() => {
    if (!allowed || admin) return;
    let active = true;
    Promise.all([
      api<{ profile: Company | null }>('/employer/profile'),
      api<{ jobs: Job[] }>('/employer/jobs'), api<{applications:Applicant[]}>('/employer/applicants'),
    ])
      .then(([p, j, a]) => {
        if (active) {
          setCompany(p.profile);
          setJobs(j.jobs);
          setApplicants(a.applications); setReady(true);
          if (!p.profile) navigate('/onboarding/employer');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [allowed, admin]);
  return (
    <div className="account-page">
      <header className="account-header">
        <Brand href="/" />
        {user && (
          <button
            className="auth-text-button"
            onClick={() =>
              void signOut()
                .then(() => navigate('/'))
                .catch((e) => setError(e.message))
            }
          >
            Sign out
          </button>
        )}
      </header>
      <main className="workspace-shell">
        {loading ? (
          <p role="status">Loading your account…</p>
        ) : sessionError ? (
          <p role="alert">{sessionError}</p>
        ) : !allowed ? (
          <section className="account-card">
            <h1>Access restricted</h1>
            <p>This area is available to {admin ? 'administrators' : 'employers'}.</p>
            <a href="/">Back to home</a>
          </section>
        ) : (
          <>
            <nav
              className="workspace-nav"
              aria-label={admin ? 'Admin navigation' : 'Employer navigation'}
            >
              {(admin
                ? [
                    ['/admin', 'Dashboard'],
                    ['/admin/verifications', 'Employer Verifications'],
                  ]
                : [
                    ['/employer/dashboard', 'Dashboard'],
                    ['/employer/jobs/new', 'Post Job'],
                    ['/employer/jobs', 'My Jobs'],
                    ['/employer/applicants', 'Applicants'],
                    ['/onboarding/employer', 'Company Profile'],
                    ['/employer/verification-status', 'Verification'],
                  ]
              ).map(([url, label]) => (
                <a key={url} href={url} aria-current={path === url ? 'page' : undefined}>
                  {label}
                </a>
              ))}
            </nav>
            {error && (
              <p className="auth-form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="account-notice" role="status">
                {message}
              </p>
            )}
            {admin ? (
              <AdminQueue />
            ) : !ready ? (
              <p role="status">Loading company workspace…</p>
            ) : (
              company && (
                <>
                  {company.verification_status !== 'verified' && (
                    <div className="account-notice">
                      <strong>Verification {company.verification_status}</strong>
                      <p>
                        {company.verification_status === 'rejected'
                          ? `Reason: ${company.verification_reason}`
                          : 'Your company is still being reviewed. You may create job drafts, but publishing is disabled.'}
                      </p>
                      <a href="/onboarding/employer">Update Verification Documents</a>
                    </div>
                  )}
                  {path === '/employer/dashboard' ? (
                    <>
                      <h1>{company.company_name}</h1>
                      <p className="account-intro">
                        Manage your vacancies and company verification.
                      </p>
                      <div className="workspace-stats">
                        {[
                          ['Verification Status', company.verification_status],
                          ['Active Jobs', jobs.filter((j) => j.status === 'active').length],
                          ['Draft Jobs', jobs.filter((j) => j.status === 'draft').length],
                          ['Closed Jobs', jobs.filter((j) => j.status === 'closed').length],
                          ['Total Applicants', applicants.length],
                          ['New Applications', applicants.filter((a) => a.status === 'submitted').length],
                          ['Under Review', applicants.filter((a) => a.status === 'under_review').length],
                          ['Shortlisted', applicants.filter((a) => a.status === 'shortlisted').length],
                          [
                            'Total Vacancies',
                            jobs
                              .filter((j) => j.status === 'active')
                              .reduce((n, j) => n + j.vacancies, 0),
                          ],
                        ].map(([label, value]) => (
                          <section className="account-card" key={label}>
                            <h2>{label}</h2>
                            <strong>{value}</strong>
                          </section>
                        ))}
                      </div>
                      <a className="button button-primary" href="/employer/jobs/new">
                        Create a job draft
                      </a>
                    </>
                  ) : (path.startsWith('/employer/applicants') || path.endsWith('/applicants')) ? <ApplicantReview applicants={applicants} jobs={jobs} path={path} changed={reload} /> : path === '/employer/jobs/new' ? (
                    <CreateJob company={company} />
                  ) : (
                    <JobList
                      applicants={applicants}
                      jobs={jobs}
                      company={company}
                      path={path}
                      changed={async (text) => {
                        setMessage(text);
                        await reload();
                      }}
                    />
                  )}
                </>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}


function CreateJob({ company }: { company: Company }) {
  const [form, setForm] = useState<Record<string, string>>({
    industry: company.industry,
    province: company.province,
    municipality: company.municipality,
    employment_type: 'Full-time',
    work_setup: 'On-site',
    vacancies: '1',
    experience_required: '0',
  });
  const [required, setRequired] = useState<string[]>([]),
    [preferred, setPreferred] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const field = (
    key: string,
    label: string,
    options?: string[],
    optional = false,
    type = 'text',
  ) => (
    <label className="account-field" key={key}>
      <span>
        {label}
        {optional ? ' (optional)' : ''}
      </span>
      {options ? (
        <select
          required={!optional}
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        >
          <option value="">Select {label}</option>
          {options.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      ) : key === 'description' ? (
        <textarea
          required
          rows={5}
          maxLength={10000}
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          required={!optional}
          type={type}
          min={key === 'vacancies' ? 1 : 0}
          maxLength={150}
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </label>
  );
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (form.salary_min && form.salary_max && Number(form.salary_min) > Number(form.salary_max))
        throw new Error('Salary maximum must be at least the minimum.');
      await api('/employer/jobs', {
        ...form,
        required_skills: required,
        preferred_skills: preferred,
        application_deadline: form.application_deadline
          ? new Date(form.application_deadline + 'T23:59:59').getTime()
          : null,
      });
      navigate('/employer/jobs?saved=1');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1>Create a job</h1>
      <p className="account-intro">Save a draft, review the vacancy, then publish it.</p>
      <p role="alert">{error}</p>
      <form
        className="account-card"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <div className="workspace-form">
            {field('title', 'Job Title')}
            {field('industry', 'Industry')}
            {field('description', 'Job Description')}
            {field('province', 'Province', provinces)}
            {field('municipality', 'Municipality / City')}
            {field('employment_type', 'Employment Type', [
              'Full-time',
              'Part-time',
              'Contract',
              'Temporary',
              'Internship',
            ])}
            {field('work_setup', 'Work Setup', ['On-site', 'Hybrid', 'Remote'])}
            {field('salary_min', 'Salary Minimum', undefined, true, 'number')}
            {field('salary_max', 'Salary Maximum', undefined, true, 'number')}
            {field('vacancies', 'Vacancies', undefined, false, 'number')}
            {field('education_required', 'Required Education', [
              'No requirement',
              'Senior High School',
              'Vocational / TESDA',
              'College Undergraduate',
              'Associate Degree',
              "Bachelor's Degree",
              'College Graduate',
              'Postgraduate',
            ])}
            {field('experience_required', 'Minimum Experience (years)', undefined, false, 'number')}
            {field('application_deadline', 'Application Deadline', undefined, true, 'date')}
          </div>
          <SkillInput label="Required Skills" value={required} onChange={setRequired} />
          <SkillInput label="Preferred Skills" value={preferred} onChange={setPreferred} />
          <div className="account-form-actions">
            <button className="button button-primary" type="submit">
              {busy ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}

function JobList({
  applicants,
  jobs,
  company,
  path,
  changed,
}: {
  applicants: Applicant[];
  jobs: Job[];
  company: Company;
  path: string;
  changed: (message: string) => Promise<void>;
}) {
  const [tab, setTab] = useState('all'),
    [action, setAction] = useState<{ job: Job; kind: 'publish' | 'close' } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const selected =
    path !== '/employer/jobs' ? jobs.find((j) => j.id === path.split('/').pop()) : null;
  const buttons = (job: Job) => (
    <div className="account-form-actions">
      <a className="button button-secondary" href={`/employer/jobs/${job.id}/applicants`}>View Applicants ({applicants.filter(a=>a.job_id===job.id).length})</a>
      <a className="button button-secondary" href={`/employer/jobs/${job.id}`}>
        View
      </a>
      {job.status === 'draft' && (
        <button
          className="button button-primary"
          disabled={company.verification_status !== 'verified'}
          onClick={() => setAction({ job, kind: 'publish' })}
        >
          Publish Job
        </button>
      )}
      {job.status === 'active' && (
        <button
          className="button button-secondary"
          onClick={() => setAction({ job, kind: 'close' })}
        >
          Close Job
        </button>
      )}
    </div>
  );
  return (
    <>
      <h1>{selected?.title || 'My Jobs'}</h1>
      {new URLSearchParams(location.search).has('saved') && (
        <p role="status">Job saved as draft.</p>
      )}
      {company.verification_status !== 'verified' && (
        <p>Company verification is required before publishing jobs.</p>
      )}
      <p role="alert">{error}</p>
      {selected ? (
        <article className="account-card">
          <span className="workspace-badge">{selected.status}</span>
          <p className="job-description">{selected.description}</p>
          <dl className="workspace-details">
            {Object.entries({
              Industry: selected.industry,
              Location: `${selected.municipality}, ${selected.province}`,
              'Employment Type': selected.employment_type,
              'Work Setup': selected.work_setup,
              'Salary Range':
                selected.salary_min === null
                  ? 'Not specified'
                  : `₱${selected.salary_min} – ₱${selected.salary_max ?? selected.salary_min}`,
              Vacancies: selected.vacancies,
              'Required Education': selected.education_required,
              'Minimum Experience': `${selected.experience_required} years`,
              'Required Skills': skills(selected.required_skills).join(', '),
              'Preferred Skills': skills(selected.preferred_skills).join(', '),
              Deadline: date(selected.application_deadline),
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || 'Not specified'}</dd>
              </div>
            ))}
          </dl>
          {buttons(selected)}
        </article>
      ) : path !== '/employer/jobs' ? (
        <p>Job not found in your company.</p>
      ) : (
        <>
          <div className="workspace-nav" aria-label="Job status filters">
            {['all', 'draft', 'active', 'closed'].map((t) => (
              <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          {jobs
            .filter((j) => tab === 'all' || j.status === tab)
            .map((job) => (
              <article className="account-card workspace-row" key={job.id}>
                <div>
                  <h2>{job.title}</h2>
                  <span className="workspace-badge">{job.status}</span>
                  <p>
                    {job.municipality}, {job.province} · {job.vacancies} vacancies
                  </p>
                  <p>
                    Created: {date(job.created_at)} · Deadline: {date(job.application_deadline)}
                  </p>
                </div>
                {buttons(job)}
              </article>
            ))}
          {!jobs.some((j) => tab === 'all' || j.status === tab) && (
            <p className="account-card">
              No {tab === 'all' ? '' : tab + ' '}jobs yet.{' '}
              <a href="/employer/jobs/new">Create a draft</a>.
            </p>
          )}
        </>
      )}
      <Modal
        isOpen={!!action}
        onClose={() => !busy && setAction(null)}
        titleId="job-confirm"
        className="workspace-dialog"
      >
        <h2 id="job-confirm">
          {action?.kind === 'publish' ? 'Publish this job?' : 'Close this job?'}
        </h2>
        <p>
          {action?.kind === 'publish'
            ? 'This vacancy will become visible to eligible Job Seekers and will enter the AI recommendation system.'
            : 'This vacancy will no longer appear in Job Seeker recommendations.'}
        </p>
        <div className="account-form-actions">
          <button
            data-modal-close
            className="button button-secondary"
            disabled={busy}
            onClick={() => setAction(null)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={async () => {
              if (!action) return;
              setBusy(true);
              try {
                await api(`/employer/jobs/${action.job.id}/${action.kind}`, {});
                await changed(
                  action.kind === 'publish' ? 'Job published successfully.' : 'Job closed.',
                );
                setAction(null);
              } catch (e) {
                setError((e as Error).message);
                setAction(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Updating…' : action?.kind === 'publish' ? 'Publish' : 'Close Job'}
          </button>
        </div>
      </Modal>
    </>
  );
}

function AdminQueue() {
  const [filter, setFilter] = useState('pending'),
    [items, setItems] = useState<Company[]>([]),
    [detail, setDetail] = useState<{ profile: Company; documents: Document[] } | null>(null),
    [action, setAction] = useState<'approve' | 'reject' | null>(null),
    [reason, setReason] = useState(''),
    [other, setOther] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const reload = async () => {
    const r = await api<{ employers: Company[] }>(`/admin/employer-verifications?status=${filter}`);
    setItems(r.employers);
    setLoaded(true);
  };
  useEffect(() => {
    let active = true;
    api<{ employers: Company[] }>(`/admin/employer-verifications?status=${filter}`)
      .then((r) => {
        if (active) {
          setItems(r.employers);
          setLoaded(true);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [filter]);
  return (
    <>
      <h1>Employer Verifications</h1>
      <p className="account-intro">Review company information and private supporting documents.</p>
      <p role="alert">{error}</p>
      <div className="workspace-nav">
        {['pending', 'verified', 'rejected'].map((s) => (
          <button
            key={s}
            aria-pressed={s === filter}
            onClick={() => {
              setFilter(s);
              setDetail(null);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {!loaded ? (
        <p role="status">Loading verifications…</p>
      ) : !items.length ? (
        <p className="account-card">No {filter} employer verifications.</p>
      ) : (
        items.map((p) => (
          <button
            key={p.user_id}
            className="account-card workspace-queue"
            onClick={() =>
              void api<{ profile: Company; documents: Document[] }>(
                `/admin/employer-verifications/${p.user_id}`,
              )
                .then(setDetail)
                .catch((e) => setError(e.message))
            }
          >
            <strong>{p.company_name}</strong>
            <span>{p.industry}</span>
            <span>
              {p.municipality}, {p.province}
            </span>
            <span>{p.contact_person}</span>
            <span>{date(p.updated_at)}</span>
            <span className="workspace-badge">{p.verification_status}</span>
          </button>
        ))
      )}
      {detail && (
        <section className="account-card">
          <h2>{detail.profile.company_name}</h2>
          <dl className="workspace-details">
            {Object.entries(detail.profile)
              .filter(([k]) => !['user_id', 'verified_by', 'updated_at', 'verified_at'].includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replaceAll('_', ' ')}</dt>
                  <dd>{v || 'Not provided'}</dd>
                </div>
              ))}
          </dl>
          <h3>Verification Documents</h3>
          {detail.documents.length ? (
            detail.documents.map((d) => (
              <p key={d.id}>
                <a href={`/api/admin/verification-documents/${d.id}`}>{d.original_filename}</a> ·{' '}
                {(d.file_size / 1024).toFixed(0)} KB · {date(d.uploaded_at)}
              </p>
            ))
          ) : (
            <p>No submitted documents.</p>
          )}
          <div className="account-form-actions">
            <button
              className="button button-secondary"
              onClick={() => {
                setAction('reject');
                setReason('');
              }}
            >
              Reject
            </button>
            <button className="button button-primary" onClick={() => setAction('approve')}>
              Approve
            </button>
          </div>
        </section>
      )}
      <Modal
        isOpen={!!action}
        onClose={() => !busy && setAction(null)}
        titleId="verification-confirm"
        className="workspace-dialog"
      >
        <h2 id="verification-confirm">
          {action === 'approve' ? 'Approve this employer?' : 'Reject this employer?'}
        </h2>
        <p>
          {action === 'approve'
            ? 'This company will be allowed to publish job vacancies.'
            : 'Explain why the verification cannot be approved.'}
        </p>
        {action === 'reject' && (
          <>
            <label className="account-field">
              <span>Rejection reason</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason</option>
                {[
                  'Missing document',
                  'Invalid document',
                  'Information mismatch',
                  'Unable to verify business',
                  'Other',
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {reason === 'Other' && (
              <label className="account-field">
                <span>Explain the reason</span>
                <textarea
                  maxLength={500}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <div className="account-form-actions">
          <button
            data-modal-close
            className="button button-secondary"
            disabled={busy}
            onClick={() => setAction(null)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={
              busy || (action === 'reject' && !(reason === 'Other' ? other.trim() : reason))
            }
            onClick={async () => {
              if (!detail || !action) return;
              setBusy(true);
              try {
                await api(
                  `/admin/employer-verifications/${detail.profile.user_id}/${action}`,
                  action === 'reject'
                    ? { rejection_reason: reason === 'Other' ? other : reason }
                    : {},
                );
                setAction(null);
                setDetail(null);
                await reload();
              } catch (e) {
                setError((e as Error).message);
                setAction(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving…' : action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </Modal>
    </>
  );
}
