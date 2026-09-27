import { useState, useEffect } from 'react';
import {
  Briefcase,
  MapPin,
  Building2,
  Clock,
  Sparkles,
  Heart,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { Modal } from '@/components/Modal';
import type { SeekerJob } from '@/types/seeker';

interface JobDetailResponse {
  job: SeekerJob & {
    verification_status?: string;
  };
  match: {
    match_percentage: number;
    matched_skills?: string[];
    missing_skills?: string[];
    semantic_score?: number;
    skills_score?: number;
    location_score?: number;
    education_score?: number;
    experience_score?: number;
  } | null;
  applied: boolean;
}

export function JobDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<JobDetailResponse | null>(null);
  const [similarJobs, setSimilarJobs] = useState<SeekerJob[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Application Modal state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [jobRes, allJobsRes, savedRes] = await Promise.all([
          api<JobDetailResponse>(`/jobs/${encodeURIComponent(id)}`).catch((err: Error) => {
            if (active) setError(err.message);
            return null;
          }),
          api<{ jobs: SeekerJob[] }>('/discovery/jobs').catch(() => null),
          api<{ job_ids: string[] }>('/saved-jobs').catch(() => null),
        ]);

        if (!active) return;
        if (jobRes) {
          setData(jobRes);
          if (allJobsRes) {
            // Find 3 similar jobs with same industry or province
            const related = allJobsRes.jobs
              .filter(
                (j) =>
                  j.id !== id &&
                  (j.industry === jobRes.job.industry || j.province === jobRes.job.province),
              )
              .slice(0, 3);
            setSimilarJobs(related);
          }
        }
        if (savedRes) {
          setSaved(savedRes.job_ids.includes(id));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const toggleSave = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      if (nextSaved) {
        await api(`/saved-jobs/${encodeURIComponent(id)}`, {}, 'PUT');
        window.dispatchEvent(
          new CustomEvent('mimawork:toast', { detail: { message: 'Job saved to your list.' } }),
        );
      } else {
        await api(`/saved-jobs/${encodeURIComponent(id)}`, {}, 'DELETE');
        window.dispatchEvent(
          new CustomEvent('mimawork:toast', { detail: { message: 'Job removed from saved.' } }),
        );
      }
    } catch {
      setSaved(!nextSaved);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyError('');
    try {
      await api(`/jobs/${encodeURIComponent(id)}/apply`, {});
      if (data) {
        setData({ ...data, applied: true });
      }
      setApplyModalOpen(false);
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: 'Application submitted successfully!' },
        }),
      );
      window.dispatchEvent(new Event('mimawork:updates'));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Could not submit application.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-8">
        <div className="sw-skeleton h-6 w-32" />
        <div className="sw-card p-6 space-y-4">
          <div className="sw-skeleton h-8 w-1/2" />
          <div className="sw-skeleton h-4 w-1/3" />
          <div className="sw-skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sw-card text-center py-12 max-w-md mx-auto my-8">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Job Unavailable</h2>
        <p className="text-sm text-slate-500 mb-4">{error || 'This job could not be loaded.'}</p>
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="sw-btn sw-btn-primary sw-btn-sm"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  const { job, match, applied } = data;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <a
          href="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            navigate('/dashboard');
          }}
          className="hover:underline text-slate-600"
        >
          Home
        </a>
        <ChevronRight size={13} className="text-slate-400" />
        <a
          href="/jobs"
          onClick={(e) => {
            e.preventDefault();
            navigate('/jobs');
          }}
          className="hover:underline text-slate-600"
        >
          Jobs
        </a>
        <ChevronRight size={13} className="text-slate-400" />
        <span className="text-slate-900 font-medium truncate max-w-xs">{job.title}</span>
      </nav>

      {/* Top Header Card */}
      <section className="sw-card p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center font-bold text-[#176b61] text-2xl shrink-0">
              {job.company_name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#176b61] flex items-center gap-1">
                  <ShieldCheck size={14} /> Verified Employer
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">{job.industry}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{job.title}</h1>
              <p className="text-base font-semibold text-slate-700 mb-2">{job.company_name}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400" />
                  {job.municipality}, {job.province}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase size={14} className="text-slate-400" />
                  {job.employment_type} • {job.work_setup}
                </span>
                {job.salary_min !== null && (
                  <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    ₱{Number(job.salary_min).toLocaleString()}
                    {job.salary_max ? ` – ₱${Number(job.salary_max).toLocaleString()}` : ''} / month
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Area: Match Score + Apply + Save */}
          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 shrink-0 pt-2 md:pt-0">
            {match && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-emerald-800 font-bold text-sm">
                <Sparkles size={16} />
                <span>{match.match_percentage}% Profile Match</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                className={`w-10 h-10 rounded-lg flex items-center justify-center border transition ${
                  saved
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                }`}
                aria-label={saved ? 'Remove from saved' : 'Save this job'}
                onClick={() => void toggleSave()}
              >
                <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
              </button>

              {applied ? (
                <button
                  type="button"
                  disabled
                  className="sw-btn bg-slate-100 text-slate-600 border border-slate-200 cursor-not-allowed flex-1 sm:flex-initial"
                >
                  <CheckCircle2 size={16} className="text-emerald-600" /> Applied
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(true)}
                  className="sw-btn sw-btn-primary flex-1 sm:flex-initial"
                >
                  Apply Now
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Details + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Match Insights */}
          {match && (
            <section className="sw-card bg-gradient-to-br from-white to-teal-50/30 border-teal-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-[#176b61]" />
                  AI Match Insights
                </h2>
                <a
                  href="/career/skills-gap"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/career/skills-gap');
                  }}
                  className="text-xs font-semibold text-[#176b61] hover:underline"
                >
                  See Skills Gap →
                </a>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Why this opportunity aligns with your profile based on verified requirements,
                skills, and location.
              </p>

              {/* Matched Skills */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Matched Skills from Your Profile:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(match.matched_skills || []).length > 0 ? (
                      match.matched_skills!.map((skill) => (
                        <span key={skill} className="sw-chip sw-chip-matched">
                          <CheckCircle2 size={13} /> {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        No exact skill matches recorded yet.
                      </span>
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                {(match.missing_skills || []).length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Skills You May Need to Develop:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {match.missing_skills!.map((skill) => (
                        <span key={skill} className="sw-chip sw-chip-gap">
                          • {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Job Overview Grid */}
          <section className="sw-card p-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">Job Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Date Posted</span>
                <span className="font-semibold text-slate-800">
                  {new Date(Number(job.created_at)).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Work Setup</span>
                <span className="font-semibold text-slate-800">{job.work_setup}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Employment Type</span>
                <span className="font-semibold text-slate-800">{job.employment_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Required Experience</span>
                <span className="font-semibold text-slate-800">
                  {job.experience_required
                    ? `${job.experience_required} years`
                    : 'Entry Level / 0 years'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Education</span>
                <span className="font-semibold text-slate-800">
                  {job.education_required || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Open Vacancies</span>
                <span className="font-semibold text-slate-800">
                  {job.vacancies} {job.vacancies === 1 ? 'position' : 'positions'}
                </span>
              </div>
            </div>
          </section>

          {/* Description */}
          <section className="sw-card p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900">Job Description</h2>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {job.description}
            </div>
          </section>

          {/* Required & Preferred Skills */}
          <section className="sw-card p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Skills & Competencies</h2>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Required Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {(job.required_skills || []).map((skill) => (
                  <span
                    key={skill}
                    className="sw-chip bg-slate-100 text-slate-800 text-xs py-1 px-2.5"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {(job.preferred_skills || []).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Preferred / Advantageous Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {job.preferred_skills!.map((skill) => (
                    <span
                      key={skill}
                      className="sw-chip bg-teal-50 text-[#176b61] text-xs py-1 px-2.5"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Similar Jobs */}
          {similarJobs.length > 0 && (
            <section className="space-y-3 pt-2">
              <h2 className="text-base font-bold text-slate-900">Similar Opportunities</h2>
              <div className="space-y-2.5">
                {similarJobs.map((simJob) => (
                  <div
                    key={simJob.id}
                    className="sw-card sw-card-clickable p-3.5 flex items-center justify-between gap-3 hover:border-slate-300"
                    onClick={() => navigate(`/jobs/${simJob.id}`)}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 hover:text-[#176b61]">
                        {simJob.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {simJob.company_name} • {simJob.municipality}, {simJob.province}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#176b61] shrink-0">View →</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Sidebar: Company Info */}
        <aside className="space-y-5">
          <div className="sw-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 size={16} className="text-[#176b61]" />
              About the Company
            </h2>

            <div>
              <h3 className="text-base font-bold text-slate-900">{job.company_name}</h3>
              <p className="text-xs text-slate-500">{job.industry}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {job.company?.description ||
                'Verified organization registered on MIMAROPA Works to connect with local talent.'}
            </p>

            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin size={14} className="text-slate-400" />
                <span>
                  {job.municipality}, {job.province}
                </span>
              </div>
              {job.company?.website && (
                <div className="flex items-center gap-2">
                  <ExternalLink size={14} className="text-slate-400" />
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#176b61] hover:underline truncate"
                  >
                    Visit company website
                  </a>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(`/people/${job.company_id}`)}
              className="sw-btn sw-btn-secondary sw-btn-sm w-full"
            >
              View Company Profile
            </button>
          </div>

          <div className="sw-card bg-slate-50 p-4 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Clock size={14} /> Application Guidance
            </div>
            <p className="leading-relaxed">
              Applying submits your verified profile and match assessment directly to the employer.
              You can withdraw an application anytime from My Applications.
            </p>
          </div>
        </aside>
      </div>

      {/* Application Confirmation Modal */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        titleId="apply-title"
        descriptionId="apply-desc"
        className="max-w-md p-6"
      >
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-full bg-teal-50 text-[#176b61] flex items-center justify-center">
            <Briefcase size={20} />
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setApplyModalOpen(false)}
            aria-label="Close dialog"
            data-modal-close
          >
            <X size={18} />
          </button>
        </div>

        <h2 id="apply-title" className="text-lg font-bold text-slate-900 mb-1">
          Apply for {job.title}?
        </h2>
        <p id="apply-desc" className="text-xs text-slate-600 mb-4 leading-relaxed">
          Your profile, contact information, and current match score will be submitted to{' '}
          <strong>{job.company_name}</strong> for review.
        </p>

        {applyError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium">
            {applyError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            className="sw-btn sw-btn-secondary sw-btn-sm"
            onClick={() => setApplyModalOpen(false)}
            disabled={applying}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sw-btn sw-btn-primary sw-btn-sm"
            onClick={() => void handleApply()}
            disabled={applying}
          >
            {applying ? 'Submitting Application…' : 'Confirm Application'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
