import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { useAuth } from '@/auth/useAuth';
import { Brand } from '../Brand';
import { Modal } from '../Modal';
import './admin.css';

type Overview = {
  generatedAt: number;
  roles: Record<string, number>;
  companies: Record<string, number>;
  jobs: Record<string, number>;
  applications: Record<string, number>;
  provinces: { label: string; count: number }[];
  industries: { label: string; count: number }[];
  demos: { companies: number; jobs: number };
  health: { expiredJobs: number; unverifiedJobs: number; missingDocuments: number };
  activity: { date: string; accounts: number; jobs: number; applications: number }[];
};
type Page<T> = { items: T[]; total: number; page: number; limit: number };
type Company = {
  user_id: string;
  company_name: string;
  industry: string;
  province: string;
  municipality: string;
  contact_person: string;
  verification_status: string;
  updated_at: number;
  job_count: number;
  document_count: number;
  is_demo: number;
};
type CompanyDetail = {
  profile: Company & {
    description: string;
    address: string;
    company_size: string;
    contact_position: string;
    business_email: string;
    contact_number: string;
    website: string;
    verification_reason: string;
  };
  documents: { id: string; original_filename: string; file_size: number; uploaded_at: number }[];
};
type Job = {
  id: string;
  title: string;
  company_name: string;
  province: string;
  municipality: string;
  industry: string;
  status: string;
  work_setup: string;
  vacancies: number;
  application_deadline: number | null;
  created_at: number;
  application_count: number;
  is_demo: number;
};
type Account = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  account_status: string;
  email_verified: number;
  created_at: number;
  is_demo: number;
};
type Audit = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, string | number | boolean>;
  created_at: number;
  actor_name: string | null;
};
const number = (value = 0) => Number(value).toLocaleString('en-PH');
const date = (value: number | null, time = false) =>
  value
    ? new Date(Number(value)).toLocaleString(
        'en-PH',
        time
          ? { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          : { month: 'short', day: 'numeric', year: 'numeric' },
      )
    : 'No deadline';
const title = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const sum = (values: Record<string, number>) =>
  Object.values(values).reduce((a, b) => a + Number(b), 0);
const views = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
  { path: '/admin/jobs', label: 'Job registry', icon: BriefcaseBusiness },
  { path: '/admin/accounts', label: 'Accounts', icon: Users },
  { path: '/admin/audit-logs', label: 'Audit log', icon: ClipboardCheck },
];

function useResource<T>(url: string | null, version = 0) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  const key = `${url}:${version}`;
  useEffect(() => {
    if (!url) return;
    let active = true;
    api<T>(url)
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((error: Error) => {
        if (active) setResult({ key, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [url, key]);
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: !!url && result.key !== key,
  };
}

function Status({ value }: { value: string }) {
  return <span className={`admin-status admin-status-${value}`}>{title(value)}</span>;
}
function Loading() {
  return (
    <div className="admin-loading" role="status">
      <span>Loading workspace data…</span>
      <div />
      <div />
      <div />
    </div>
  );
}
function ErrorNotice({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="admin-error" role="alert">
      <p>{error}</p>
      <button className="admin-button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="admin-empty">
      <Search size={24} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
function Pagination({ data, setPage }: { data: Page<unknown>; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  return (
    <div className="admin-pagination">
      <p>
        {data.total
          ? `${number((data.page - 1) * data.limit + 1)}–${number(Math.min(data.page * data.limit, data.total))} of ${number(data.total)}`
          : '0 results'}
      </p>
      <div>
        <button
          className="admin-button"
          disabled={data.page <= 1}
          onClick={() => setPage(data.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {data.page} of {pages}
        </span>
        <button
          className="admin-button"
          disabled={data.page >= pages}
          onClick={() => setPage(data.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
function SearchForm({ label, onSearch }: { label: string; onSearch: (query: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="admin-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
    >
      <label className="admin-sr-only" htmlFor="admin-search-input">
        {label}
      </label>
      <Search size={18} aria-hidden="true" />
      <input
        id="admin-search-input"
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (!e.target.value) onSearch('');
        }}
        placeholder={label}
        maxLength={100}
      />
      <button className="admin-button" type="submit">
        Search
      </button>
    </form>
  );
}
function Bars({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(...rows.map((row) => Number(row.count)), 1);
  return rows.length ? (
    <div className="admin-bars">
      {rows.map((row) => (
        <div className="admin-bar" key={row.label}>
          <span>{row.label || 'Not specified'}</span>
          <strong>{number(row.count)}</strong>
          <div className="admin-bar-track">
            <div style={{ width: `${Math.max((Number(row.count) / max) * 100, 1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="admin-subtle">{empty}</p>
  );
}

function OverviewPanel({ data }: { data: Overview }) {
  const [metric, setMetric] = useState<'accounts' | 'jobs' | 'applications'>('accounts');
  const total = data.activity.reduce((n, d) => n + d[metric], 0);
  const peak = Math.max(...data.activity.map((d) => d[metric]), 1);
  return (
    <>
      <section className="admin-attention">
        <div>
          <ShieldCheck size={24} aria-hidden="true" />
          <div>
            <h2>
              {data.companies.pending
                ? `${number(data.companies.pending)} ${data.companies.pending === 1 ? 'company needs' : 'companies need'} a review`
                : 'Your verification queue is clear'}
            </h2>
            <p>
              {data.companies.pending
                ? 'Check company details and supporting documents before approval.'
                : 'New employer submissions will appear in Verifications.'}
            </p>
          </div>
        </div>
        <a href="/admin/verifications" className="admin-button admin-button-primary">
          Review companies <ArrowRight size={16} />
        </a>
      </section>
      <dl className="admin-metrics">
        <div>
          <dt>Registered accounts</dt>
          <dd>
            {number(sum(data.roles))}
            <p>
              {number(data.roles.job_seeker)} job seekers · {number(data.roles.employer)} employers
            </p>
          </dd>
        </div>
        <div>
          <dt>Verified companies</dt>
          <dd>
            {number(data.companies.verified)}
            <p>{number(sum(data.companies))} company profiles in total</p>
          </dd>
        </div>
        <div>
          <dt>Active job listings</dt>
          <dd>
            {number(data.jobs.active)}
            <p>
              {number(data.jobs.draft)} drafts · {number(data.jobs.closed)} closed
            </p>
          </dd>
        </div>
        <div>
          <dt>Applications received</dt>
          <dd>
            {number(sum(data.applications))}
            <p>Across all recorded job listings</p>
          </dd>
        </div>
      </dl>
      <div className="admin-overview-grid">
        <section className="admin-panel admin-activity">
          <div className="admin-panel-heading">
            <div>
              <h2>Platform activity</h2>
              <p>Last 30 days · UTC daily totals</p>
            </div>
            <label className="admin-field">
              <span className="admin-sr-only">Activity metric</span>
              <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
                <option value="accounts">New accounts</option>
                <option value="jobs">New jobs</option>
                <option value="applications">Applications</option>
              </select>
            </label>
          </div>
          <p className="admin-activity-summary">
            <strong>{number(total)}</strong>{' '}
            {metric === 'accounts'
              ? 'accounts registered'
              : metric === 'jobs'
                ? 'jobs created'
                : 'applications submitted'}{' '}
            in this period
          </p>
          <div
            className="admin-day-chart"
            role="img"
            aria-label={`${number(total)} ${metric} over the last 30 days. Daily values are available in the table below.`}
          >
            {data.activity.map((day) => (
              <div key={day.date} title={`${day.date}: ${day[metric]}`}>
                <span
                  style={{
                    height: `${day[metric] ? Math.max((day[metric] / peak) * 100, 3) : 0}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="admin-chart-axis">
            <span>{data.activity[0]?.date}</span>
            <span>{data.activity.at(-1)?.date}</span>
          </div>
          <details className="admin-chart-values">
            <summary>View daily values</summary>
            <div
              className="admin-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Daily activity values"
            >
              <table>
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Accounts</th>
                    <th>Jobs</th>
                    <th>Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity
                    .slice()
                    .reverse()
                    .map((day) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td>{number(day.accounts)}</td>
                        <td>{number(day.jobs)}</td>
                        <td>{number(day.applications)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Verification status</h2>
              <p>All registered company profiles</p>
            </div>
          </div>
          <div className="admin-status-breakdown">
            {['pending', 'verified', 'rejected'].map((status) => (
              <a href={`/admin/verifications?status=${status}`} key={status}>
                <Status value={status} />
                <strong>{number(data.companies[status])}</strong>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            ))}
          </div>
          <h3 className="admin-section-label">Needs attention</h3>
          <ul className="admin-health">
            <li>
              <span>Pending without documents</span>
              <strong>{number(data.health.missingDocuments)}</strong>
            </li>
            <li>
              <span>Active jobs past deadline</span>
              <strong>{number(data.health.expiredJobs)}</strong>
            </li>
            <li>
              <span>Active jobs without verified company</span>
              <strong>{number(data.health.unverifiedJobs)}</strong>
            </li>
          </ul>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Jobs by province</h2>
              <p>Active listings accepting applications</p>
            </div>
          </div>
          <Bars
            rows={data.provinces}
            empty="Province data will appear when active jobs are available."
          />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Leading industries</h2>
              <p>Top 8 by active listings accepting applications</p>
            </div>
          </div>
          <Bars
            rows={data.industries}
            empty="Industry data will appear when active jobs are available."
          />
        </section>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Application pipeline</h2>
            <p>Actual application records by current stage</p>
          </div>
        </div>
        {sum(data.applications) ? (
          <Bars
            rows={Object.entries(data.applications).map(([label, count]) => ({
              label: title(label),
              count,
            }))}
            empty=""
          />
        ) : (
          <p className="admin-subtle">
            No applications have been submitted yet. Application stages will appear here as
            candidates apply.
          </p>
        )}
      </section>
    </>
  );
}

function Verifications({ onChange }: { onChange: () => void }) {
  const reviewRef = useRef<HTMLElement>(null);
  const initial = new URLSearchParams(window.location.search).get('status');
  const [status, setStatus] = useState(
    initial && ['pending', 'verified', 'rejected'].includes(initial) ? initial : 'pending',
  );
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string | null>(null),
    [action, setAction] = useState<'approve' | 'reject' | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const result = useResource<Page<Company>>(
    `/admin/companies?status=${status}&q=${encodeURIComponent(query)}&page=${page}`,
    version,
  );
  const detail = useResource<CompanyDetail>(
    selected ? `/admin/employer-verifications/${selected}` : null,
    version,
  );
  useEffect(() => {
    if (detail.data && reviewRef.current) {
      reviewRef.current.focus({ preventScroll: true });
      reviewRef.current.scrollIntoView({ block: 'start' });
    }
  }, [detail.data]);
  const refresh = () => setVersion((v) => v + 1);
  const decide = async () => {
    if (!selected || !action) return;
    setBusy(true);
    setError('');
    try {
      await api(
        `/admin/employer-verifications/${selected}/${action}`,
        action === 'reject' ? { rejection_reason: reason.trim() } : {},
      );
      setNotice(
        `${detail.data?.profile.company_name || 'Company'} ${action === 'approve' ? 'verified' : 'rejected'}. The decision is saved.`,
      );
      setAction(null);
      setSelected(null);
      refresh();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-tabs" aria-label="Verification status">
          {['pending', 'verified', 'rejected'].map((value) => (
            <button
              key={value}
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
                setSelected(null);
              }}
            >
              {title(value)}
            </button>
          ))}
        </div>
        <SearchForm
          label="Search company, contact or province"
          onSearch={(value) => {
            setQuery(value);
            setPage(1);
          }}
        />
      </div>
      {notice && (
        <p className="admin-success" role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </p>
      )}
      {result.error && <ErrorNotice error={result.error} retry={refresh} />}
      {result.loading && <Loading />}
      {result.data && (
        <section className="admin-panel admin-table-panel">
          <div className="admin-panel-heading">
            <h2>
              {title(status)} companies{' '}
              <span className="admin-count">{number(result.data.total)}</span>
            </h2>
            <button className="admin-button" onClick={refresh} aria-label="Refresh companies">
              <RefreshCw size={16} />
            </button>
          </div>
          {result.data.items.length ? (
            <div
              className="admin-table-scroll"
              role="region"
              aria-label={`${title(status)} company directory`}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Documents</th>
                    <th>Jobs</th>
                    <th>Updated</th>
                    <th>
                      <span className="admin-sr-only">Review</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((company) => (
                    <tr
                      key={company.user_id}
                      className={selected === company.user_id ? 'admin-row-selected' : ''}
                    >
                      <td>
                        <strong>{company.company_name}</strong>
                        <span>{company.industry}</span>
                        {!!company.is_demo && <small>Demo company</small>}
                      </td>
                      <td>
                        {company.municipality}
                        <span>{company.province}</span>
                      </td>
                      <td>{number(company.document_count)} files</td>
                      <td>{number(company.job_count)}</td>
                      <td>{date(company.updated_at)}</td>
                      <td>
                        <button
                          className="admin-button"
                          aria-label={`Review ${company.company_name}`}
                          onClick={() => {
                            setSelected(company.user_id);
                            setError('');
                          }}
                        >
                          Review <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              {query
                ? 'No companies match this search. Try a company name, contact or province.'
                : `No ${status} companies. Select another status to browse your directory.`}
            </Empty>
          )}
          <Pagination data={result.data} setPage={setPage} />
        </section>
      )}
      {selected && (
        <section
          ref={reviewRef}
          tabIndex={-1}
          className="admin-panel admin-company-review"
          aria-label="Company review"
        >
          <div className="admin-panel-heading">
            <h2>Company review</h2>
            <button
              className="admin-button"
              onClick={() => setSelected(null)}
              aria-label="Close company review"
            >
              <X size={18} />
            </button>
          </div>
          {detail.loading && <Loading />}
          {detail.error && <ErrorNotice error={detail.error} retry={refresh} />}
          {detail.data && (
            <>
              <div className="admin-company-title">
                <Building2 size={28} aria-hidden="true" />
                <div>
                  <h3>{detail.data.profile.company_name}</h3>
                  <p>{detail.data.profile.industry}</p>
                </div>
                <Status value={detail.data.profile.verification_status} />
              </div>
              <p className="admin-company-description">
                {detail.data.profile.description || 'No company description provided.'}
              </p>
              <dl className="admin-detail-grid">
                <div>
                  <dt>Business address</dt>
                  <dd>
                    {[
                      detail.data.profile.address,
                      detail.data.profile.municipality,
                      detail.data.profile.province,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Recruitment representative</dt>
                  <dd>
                    {detail.data.profile.contact_person}
                    <span>{detail.data.profile.contact_position}</span>
                  </dd>
                </div>
                <div>
                  <dt>Business email</dt>
                  <dd>{detail.data.profile.business_email}</dd>
                </div>
                <div>
                  <dt>Contact number</dt>
                  <dd>{detail.data.profile.contact_number || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Company size</dt>
                  <dd>{detail.data.profile.company_size || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>{detail.data.profile.website || 'Not provided'}</dd>
                </div>
              </dl>
              {detail.data.profile.verification_reason && (
                <p className="admin-rejection">
                  <strong>Previous rejection reason:</strong>{' '}
                  {detail.data.profile.verification_reason}
                </p>
              )}
              <h3 className="admin-section-label">Supporting documents</h3>
              {detail.data.documents.length ? (
                <ul className="admin-documents">
                  {detail.data.documents.map((document) => (
                    <li key={document.id}>
                      <FileText size={20} aria-hidden="true" />
                      <div>
                        <strong>{document.original_filename}</strong>
                        <span>
                          {number(Math.ceil(document.file_size / 1024))} KB · Uploaded{' '}
                          {date(document.uploaded_at)}
                        </span>
                      </div>
                      <a
                        className="admin-button"
                        href={`/api/admin/verification-documents/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Download ${document.original_filename}`}
                      >
                        <ArrowDownToLine size={17} />
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-subtle">
                  No verification documents have been submitted. Confirm the business evidence
                  before approving this company.
                </p>
              )}
              <div className="admin-review-actions">
                <p>Approval allows this employer to publish job vacancies.</p>
                {detail.data.profile.verification_status !== 'rejected' && (
                  <button
                    className="admin-button admin-button-danger"
                    onClick={() => {
                      setAction('reject');
                      setReason('');
                      setError('');
                    }}
                  >
                    Reject company
                  </button>
                )}
                {detail.data.profile.verification_status !== 'verified' && (
                  <button
                    className="admin-button admin-button-primary"
                    onClick={() => {
                      setAction('approve');
                      setError('');
                    }}
                  >
                    Verify company
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
      <Modal
        isOpen={!!action}
        onClose={() => {
          if (!busy) setAction(null);
        }}
        titleId="admin-decision-title"
        className="admin-decision-dialog"
      >
        <div className="admin-dialog-heading">
          <h2 id="admin-decision-title">
            {action === 'approve' ? 'Verify this company?' : 'Reject this company?'}
          </h2>
          <button
            data-modal-close
            className="admin-button"
            disabled={busy}
            onClick={() => setAction(null)}
            aria-label="Close decision"
          >
            <X size={18} />
          </button>
        </div>
        <p>{detail.data?.profile.company_name}</p>
        <p>
          {action === 'approve'
            ? 'This employer will be allowed to publish jobs. Confirm that you have reviewed its company details and supporting evidence.'
            : 'Give a clear reason so the employer knows what to correct before resubmitting.'}
        </p>
        {action === 'reject' && (
          <label className="admin-field">
            <span>Reason for rejection</span>
            <textarea
              value={reason}
              maxLength={500}
              rows={4}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain which information or document needs correction."
            />
            <small>{reason.length}/500 characters</small>
          </label>
        )}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-dialog-actions">
          <button className="admin-button" disabled={busy} onClick={() => setAction(null)}>
            Cancel
          </button>
          <button
            className={`admin-button ${action === 'reject' ? 'admin-button-danger' : 'admin-button-primary'}`}
            disabled={busy || (action === 'reject' && !reason.trim())}
            onClick={() => void decide()}
          >
            {busy
              ? 'Saving decision…'
              : action === 'approve'
                ? 'Confirm verification'
                : 'Confirm rejection'}
          </button>
        </div>
      </Modal>
    </>
  );
}

function Directory({ kind }: { kind: 'jobs' | 'accounts' | 'audit-logs' }) {
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const parameter = kind === 'accounts' ? 'role' : kind === 'audit-logs' ? 'action' : 'status';
  const result = useResource<Page<Job | Account | Audit>>(
    `/admin/${kind}?${parameter}=${filter}&q=${encodeURIComponent(query)}&page=${page}`,
    version,
  );
  const options =
    kind === 'accounts'
      ? ['all', 'job_seeker', 'employer', 'admin']
      : kind === 'jobs'
        ? ['all', 'active', 'draft', 'closed']
        : [
            'all',
            'company.verified',
            'company.rejected',
            'company.submitted',
            'company.profile_updated',
            'job.created',
            'job.published',
            'job.closed',
            'admin.signed_in',
            'demo.seeded',
          ];
  const label =
    kind === 'jobs'
      ? 'Search job, company or province'
      : kind === 'accounts'
        ? 'Search name or email'
        : 'Search action, actor or record';
  return (
    <>
      <div className="admin-toolbar">
        <SearchForm
          key={kind}
          label={label}
          onSearch={(value) => {
            setQuery(value);
            setPage(1);
          }}
        />
        <label className="admin-filter">
          <span>{title(parameter)}</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option === 'all'
                  ? 'All ' +
                    (kind === 'accounts' ? 'roles' : kind === 'jobs' ? 'statuses' : 'actions')
                  : title(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {kind === 'audit-logs' && (
        <p className="admin-context-note">
          Records begin when audit logging was enabled. Company decisions and job changes are
          recorded as they happen; earlier activity is not reconstructed.
        </p>
      )}
      {result.error && <ErrorNotice error={result.error} retry={() => setVersion((v) => v + 1)} />}
      {result.loading && <Loading />}
      {result.data && (
        <section className="admin-panel admin-table-panel">
          <div className="admin-panel-heading">
            <h2>
              {kind === 'jobs'
                ? 'Job listings'
                : kind === 'accounts'
                  ? 'Registered accounts'
                  : 'Recorded activity'}{' '}
              <span className="admin-count">{number(result.data.total)}</span>
            </h2>
            <button
              className="admin-button"
              onClick={() => setVersion((v) => v + 1)}
              aria-label="Refresh directory"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {result.data.items.length ? (
            <div
              className="admin-table-scroll"
              role="region"
              aria-label={kind === 'audit-logs' ? 'Audit log records' : `${title(kind)} directory`}
              tabIndex={0}
            >
              <table>
                {kind === 'jobs' ? (
                  <>
                    <thead>
                      <tr>
                        <th>Job / company</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Vacancies</th>
                        <th>Applications</th>
                        <th>Deadline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.data.items as Job[]).map((job) => (
                        <tr key={job.id}>
                          <td>
                            <strong>{job.title}</strong>
                            <span>{job.company_name}</span>
                            {!!job.is_demo && <small>Demo listing</small>}
                          </td>
                          <td>
                            {job.municipality}
                            <span>{job.province}</span>
                          </td>
                          <td>
                            <Status value={job.status} />
                            {job.status === 'active' &&
                              job.application_deadline !== null &&
                              Number(job.application_deadline) < now && (
                                <small>Deadline passed</small>
                              )}
                          </td>
                          <td>{number(job.vacancies)}</td>
                          <td>{number(job.application_count)}</td>
                          <td>{date(job.application_deadline)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : kind === 'accounts' ? (
                  <>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Email verified</th>
                        <th>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.data.items as Account[]).map((account) => (
                        <tr key={account.id}>
                          <td>
                            <strong>{account.full_name}</strong>
                            <span>{account.email}</span>
                            {!!account.is_demo && <small>Demo account</small>}
                          </td>
                          <td>{title(account.role)}</td>
                          <td>
                            <Status value={account.account_status} />
                          </td>
                          <td>{account.email_verified ? 'Verified' : 'Not verified'}</td>
                          <td>{date(account.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Performed by</th>
                        <th>Record / details</th>
                        <th>Date and time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.data.items as Audit[]).map((log) => (
                        <tr key={log.id}>
                          <td>
                            <strong>{title(log.action)}</strong>
                            <span>{title(log.entity_type)}</span>
                          </td>
                          <td>{log.actor_name || 'System'}</td>
                          <td>
                            <div className="admin-audit-details">
                              {Object.entries(log.details).map(([key, value]) => (
                                <span key={key}>
                                  <b>{title(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}:</b>{' '}
                                  {String(value)}
                                </span>
                              ))}
                              {log.entity_id && <small>Record: {log.entity_id}</small>}
                            </div>
                          </td>
                          <td>{date(log.created_at, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          ) : (
            <Empty>
              {kind === 'audit-logs' && !query && filter === 'all'
                ? 'No audit events yet. New company decisions and job changes will appear here.'
                : 'No records match these filters. Clear the search or choose another filter.'}
            </Empty>
          )}
          <Pagination data={result.data} setPage={setPage} />
        </section>
      )}
    </>
  );
}

export function AdminWorkspace({ path }: { path: string }) {
  const { user, loading, sessionError, signOut } = useAuth();
  const [version, setVersion] = useState(0),
    [overviewRevision, setOverviewRevision] = useState(0),
    [signingOut, setSigningOut] = useState(false),
    [signOutError, setSignOutError] = useState('');
  const allowed = user?.role === 'admin';
  const overview = useResource<Overview>(
    allowed ? '/admin/overview' : null,
    version + overviewRevision,
  );
  const active = views.find((view) => view.path === path);
  useEffect(() => {
    if (!loading && !sessionError && !user) navigate('/admin/login');
  }, [loading, sessionError, user]);
  useEffect(() => {
    document.title = `${active?.label || 'Administration'} | MIMAROPA Works`;
  }, [active?.label]);
  const descriptions: Record<string, string> = {
    '/admin': 'A clear view of employers, opportunities and platform activity.',
    '/admin/verifications': 'Review business evidence and manage employer verification decisions.',
    '/admin/jobs': 'Track every listing, its status and the applications it receives.',
    '/admin/accounts': 'Find registered members and check their roles and account status.',
    '/admin/audit-logs': 'Trace recorded decisions and changes across the platform.',
  };
  if (loading)
    return (
      <main className="admin-access">
        <Loading />
      </main>
    );
  if (sessionError)
    return (
      <main className="admin-access">
        <h1>Unable to load your session</h1>
        <p role="alert">{sessionError}</p>
        <button className="admin-button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!user)
    return (
      <main className="admin-access">
        <p role="status">Opening administrator sign in…</p>
      </main>
    );
  if (!allowed)
    return (
      <main className="admin-access">
        <ShieldCheck size={32} />
        <h1>Administrator access required</h1>
        <p>This workspace is only available to administrator accounts.</p>
        <a
          className="admin-button admin-button-primary"
          href={user.role === 'employer' ? '/employer/dashboard' : '/dashboard'}
        >
          Return to your workspace
        </a>
      </main>
    );
  return (
    <div className="admin-shell">
      <a className="admin-skip" href="#admin-content">
        Skip to workspace
      </a>
      <aside className="admin-sidebar">
        <Brand light href="/admin" />
        <div className="admin-workspace-label">
          <ShieldCheck size={16} />
          Administration
        </div>
        <nav aria-label="Administration">
          {views.map((view) => (
            <a
              key={view.path}
              href={view.path}
              aria-current={path === view.path ? 'page' : undefined}
            >
              <view.icon size={19} />
              <span>{view.label}</span>
              {view.path === '/admin/verifications' && !!overview.data?.companies.pending && (
                <b>{number(overview.data.companies.pending)}</b>
              )}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <p>MIMAROPA Works</p>
          <span>Regional opportunity, responsibly managed.</span>
          <a href="/admin/jobs">
            View job registry <ArrowRight size={15} />
          </a>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>Platform administration</span>
          <div>
            <span className="admin-avatar" aria-hidden="true">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>{user.name}</span>
            <button
              className="admin-button"
              disabled={signingOut}
              aria-label="Sign out"
              onClick={async () => {
                setSigningOut(true);
                setSignOutError('');
                try {
                  await signOut();
                  navigate('/admin/login');
                } catch (e) {
                  setSignOutError((e as Error).message);
                } finally {
                  setSigningOut(false);
                }
              }}
            >
              <LogOut size={17} />
              <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </header>
        <main id="admin-content" className="admin-content">
          <div className="admin-page-heading">
            <div>
              <h1>{active?.label || 'Page not found'}</h1>
              <p>
                {descriptions[path] || 'Choose a destination from the administration navigation.'}
              </p>
            </div>
            {active && (
              <button
                className="admin-button"
                onClick={() => setVersion((v) => v + 1)}
                disabled={overview.loading}
              >
                <RefreshCw size={16} />
                Refresh data
              </button>
            )}
          </div>
          {signOutError && (
            <p className="admin-error" role="alert">
              {signOutError}
            </p>
          )}
          {overview.data &&
            (Number(overview.data.demos.companies) > 0 || Number(overview.data.demos.jobs) > 0) && (
              <div className="admin-demo-note">
                <FileText size={17} aria-hidden="true" />
                <p>
                  Includes <strong>{number(overview.data.demos.companies)} demo companies</strong>{' '}
                  and <strong>{number(overview.data.demos.jobs)} demo jobs</strong>. These are
                  fictional records for exploring the platform.
                </p>
              </div>
            )}
          {path === '/admin' ? (
            overview.error ? (
              <ErrorNotice error={overview.error} retry={() => setVersion((v) => v + 1)} />
            ) : overview.data ? (
              <OverviewPanel data={overview.data} />
            ) : (
              <Loading />
            )
          ) : path === '/admin/verifications' ? (
            <Verifications key={version} onChange={() => setOverviewRevision((v) => v + 1)} />
          ) : path === '/admin/jobs' ? (
            <Directory key={`jobs-${version}`} kind="jobs" />
          ) : path === '/admin/accounts' ? (
            <Directory key={`accounts-${version}`} kind="accounts" />
          ) : path === '/admin/audit-logs' ? (
            <Directory key={`audit-${version}`} kind="audit-logs" />
          ) : (
            <a className="admin-button admin-button-primary" href="/admin">
              Open overview
            </a>
          )}
          <footer className="admin-content-footer">
            <span>Counts are calculated from stored platform records.</span>
            {overview.data && <span>Updated {date(overview.data.generatedAt, true)}</span>}
          </footer>
        </main>
      </div>
    </div>
  );
}
