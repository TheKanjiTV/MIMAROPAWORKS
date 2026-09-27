import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  Building2,
  ArrowRight,
  FileCheck2,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import type { RecommendedVacancy, SeekerHomeResponse } from '@/types/career';
import type { ProfessionalProfile, SeekerJob, SeekerCompany } from '@/types/seeker';
import { statusLabels } from '@/types/application';
import { VacancyCard } from './VacancyCard';

type DiscoveryTab = 'recommended' | 'latest' | 'nearby' | 'remote' | 'saved';
type Resource = 'home' | 'jobs' | 'companies' | 'saved' | 'profile';

function followLink(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  navigate(event.currentTarget.pathname + event.currentTarget.search);
}

export function SeekerDashboard() {
  const { user } = useAuth();
  const [homeData, setHomeData] = useState<SeekerHomeResponse | null>(null);
  const [allJobs, setAllJobs] = useState<SeekerJob[]>([]);
  const [companies, setCompanies] = useState<SeekerCompany[]>([]);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const pendingSaves = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<Resource, boolean>>>({});
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('recommended');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLocation, setSearchLocation] = useState('');

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const [homeResult, jobsResult, companiesResult, savedResult, profileResult] =
        await Promise.allSettled([
          api<SeekerHomeResponse>('/job-seeker/home'),
          api<{ jobs: SeekerJob[] }>('/discovery/jobs'),
          api<{ companies: SeekerCompany[] }>('/discovery/companies'),
          api<{ job_ids: string[] }>('/saved-jobs'),
          api<{ profile: ProfessionalProfile }>('/job-seeker/professional-profile'),
        ]);

      if (!active) return;
      setHomeData(homeResult.status === 'fulfilled' ? homeResult.value : null);
      setAllJobs(jobsResult.status === 'fulfilled' ? jobsResult.value.jobs : []);
      setCompanies(companiesResult.status === 'fulfilled' ? companiesResult.value.companies : []);
      setSavedIds(new Set(savedResult.status === 'fulfilled' ? savedResult.value.job_ids : []));
      setProfile(profileResult.status === 'fulfilled' ? profileResult.value.profile : null);
      setLoadErrors({
        home: homeResult.status === 'rejected',
        jobs: jobsResult.status === 'rejected',
        companies: companiesResult.status === 'rejected',
        saved: savedResult.status === 'rejected',
        profile: profileResult.status === 'rejected',
      });
      setLoading(false);
    };
    void loadData();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const retryLoad = () => {
    setLoading(true);
    setLoadErrors({});
    setSaveError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchTitle.trim()) params.set('q', searchTitle.trim());
    if (searchLocation.trim()) params.set('loc', searchLocation.trim());
    navigate(params.size ? `/jobs?${params.toString()}` : '/jobs');
  };

  const toggleSaveJob = async (jobId: string) => {
    if (loading || loadErrors.saved || pendingSaves.current.has(jobId)) return;
    const wasSaved = savedIds.has(jobId);
    pendingSaves.current.add(jobId);
    setSavingIds(new Set(pendingSaves.current));
    setSaveError('');
    try {
      await api(`/saved-jobs/${encodeURIComponent(jobId)}`, {}, wasSaved ? 'DELETE' : 'PUT');
      setSavedIds((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.delete(jobId);
        else next.add(jobId);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: wasSaved ? 'Job removed from saved.' : 'Job saved to your list.' },
        }),
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : `We couldn't ${wasSaved ? 'remove' : 'save'} this job. Please try again.`,
      );
    } finally {
      pendingSaves.current.delete(jobId);
      setSavingIds(new Set(pendingSaves.current));
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const userProvince = profile?.province?.trim() || '';
  const latestJobs = [...allJobs].sort(
    (first, second) => Number(second.created_at) - Number(first.created_at),
  );
  const recommendations = homeData?.recommendations || [];
  const nearbyJobs = userProvince
    ? latestJobs.filter((job) => job.province?.trim().toLowerCase() === userProvince.toLowerCase())
    : [];
  const remoteJobs = latestJobs.filter((job) => job.work_setup?.toLowerCase() === 'remote');
  const savedJobs = latestJobs.filter((job) => savedIds.has(job.id));
  const availableJobs: Record<DiscoveryTab, (SeekerJob | RecommendedVacancy)[]> = {
    recommended: recommendations,
    latest: latestJobs,
    nearby: nearbyJobs,
    remote: remoteJobs,
    saved: savedJobs,
  };
  const displayedJobs = availableJobs[activeTab].slice(0, 6);
  const feedError =
    activeTab === 'recommended'
      ? loadErrors.home
      : loadErrors.jobs ||
        (activeTab === 'nearby' && loadErrors.profile) ||
        (activeTab === 'saved' && loadErrors.saved);
  const hasLoadError = Object.values(loadErrors).some(Boolean);
  const companiesHiring = companies.filter((company) => company.open_jobs > 0).slice(0, 4);
  const appCounts = homeData?.applications || [];
  const totalApps = appCounts.reduce((sum, application) => sum + application.count, 0);
  const completion =
    typeof user?.profileCompletion === 'number' && Number.isFinite(user.profileCompletion)
      ? Math.max(0, Math.min(100, Math.round(user.profileCompletion)))
      : null;
  const resumeStatus = !profile
    ? 'Unavailable'
    : !profile.resume
      ? 'Not uploaded'
      : profile.resume.parsing_status === 'completed'
        ? 'Analyzed'
        : profile.resume.parsing_status === 'failed'
          ? 'Needs review'
          : profile.resume.parsing_status === 'pending' ||
              profile.resume.parsing_status === 'processing'
            ? 'Processing'
            : 'Uploaded';
  const feedHeadings: Record<DiscoveryTab, { title: string; description: string }> = {
    recommended: {
      title: 'Recommended for you',
      description: 'Opportunities ranked using your skills and job preferences.',
    },
    latest: {
      title: 'Latest opportunities',
      description: 'New vacancies from employers across MIMAROPA.',
    },
    nearby: {
      title: 'In your province',
      description: userProvince
        ? `Open roles in ${userProvince}, based on your profile.`
        : 'Find opportunities in the province on your profile.',
    },
    remote: {
      title: 'Remote opportunities',
      description: 'Open roles listed with a remote work setup.',
    },
    saved: {
      title: 'Your saved jobs',
      description: 'Open opportunities you bookmarked for another look.',
    },
  };
  const emptyStates: Record<
    DiscoveryTab,
    { title: string; description: string; href: string; action: string }
  > = {
    recommended: {
      title: 'No recommendations yet',
      description:
        'Keep your skills and preferred role up to date to help us find relevant opportunities.',
      href: '/profile',
      action: 'Update your profile',
    },
    latest: {
      title: 'No open vacancies right now',
      description: 'New opportunities will appear here when employers publish them.',
      href: '/people',
      action: 'Explore companies',
    },
    nearby: userProvince
      ? {
          title: `No open jobs in ${userProvince}`,
          description:
            'Explore other provinces or remote roles while you wait for local opportunities.',
          href: '/jobs',
          action: 'Browse all jobs',
        }
      : {
          title: 'Add your province',
          description: 'Set your location in your profile to find opportunities in your province.',
          href: '/profile',
          action: 'Update your location',
        },
    remote: {
      title: 'No remote roles right now',
      description: 'You can still explore on-site and hybrid opportunities across MIMAROPA.',
      href: '/jobs',
      action: 'Browse all jobs',
    },
    saved: {
      title: savedIds.size ? 'No open saved jobs' : 'Save a job for later',
      description: savedIds.size
        ? 'Your saved opportunities may have closed. Browse current vacancies to find your next role.'
        : 'Use the bookmark button on a job to keep it here while you explore.',
      href: '/jobs',
      action: 'Find a job to save',
    },
  };
  const emptyState = emptyStates[activeTab];

  return (
    <div className="sw-page">
      <section className="sw-home-intro" aria-labelledby="home-title">
        <h1 id="home-title" className="sw-page-title">
          {greeting}, {firstName}.
        </h1>
        <p className="sw-page-description">Find your next opportunity, here in MIMAROPA.</p>
        <form
          onSubmit={handleSearch}
          className="sw-search-form"
          role="search"
          aria-label="Search job vacancies"
        >
          <div className="sw-search-field">
            <label htmlFor="home-job-search">What work are you looking for?</label>
            <div className="sw-search-input">
              <Search size={19} aria-hidden="true" />
              <input
                id="home-job-search"
                type="search"
                placeholder="Job title, company, or skill"
                value={searchTitle}
                onChange={(event) => setSearchTitle(event.target.value)}
              />
            </div>
          </div>
          <div className="sw-search-field">
            <label htmlFor="home-location-search">Where?</label>
            <div className="sw-search-input">
              <MapPin size={19} aria-hidden="true" />
              <input
                id="home-location-search"
                type="text"
                placeholder="City or province"
                value={searchLocation}
                onChange={(event) => setSearchLocation(event.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="sw-btn sw-btn-primary">
            Search jobs <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
      </section>

      {hasLoadError && (
        <div className="sw-alert" role="alert">
          <div>
            <strong>Some dashboard information couldn't be loaded.</strong>
            <p>
              {loadErrors.saved
                ? 'Saved jobs are unavailable. Refresh before saving or removing a job.'
                : 'Check your connection, then try again to refresh your dashboard.'}
            </p>
          </div>
          <button
            type="button"
            className="sw-btn sw-btn-secondary"
            disabled={loading || savingIds.size > 0}
            onClick={retryLoad}
          >
            Try again
          </button>
        </div>
      )}

      <div className="sw-home-layout">
        <div className="sw-feed">
          <section aria-labelledby="home-feed-heading" aria-busy={loading}>
            <div className="sw-discovery-tabs" role="group" aria-label="Choose jobs to discover">
              {(
                [
                  ['recommended', 'For you'],
                  ['latest', 'Latest'],
                  ['nearby', 'In your province'],
                  ['remote', 'Remote'],
                  ['saved', loadErrors.saved || loading ? 'Saved' : `Saved (${savedIds.size})`],
                ] as [DiscoveryTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeTab === id}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="sw-section-heading">
              <div>
                <h2 id="home-feed-heading">{feedHeadings[activeTab].title}</h2>
                <p>{feedHeadings[activeTab].description}</p>
              </div>
              <a
                href={activeTab === 'recommended' ? '/jobs/recommended' : `/jobs?tab=${activeTab}`}
                onClick={followLink}
                className="sw-text-link"
              >
                {activeTab === 'saved'
                  ? 'View saved jobs'
                  : activeTab === 'recommended'
                    ? 'View all matches'
                    : 'View all jobs'}{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            {saveError && (
              <p className="sw-alert" role="alert">
                {saveError}
              </p>
            )}
            {loading ? (
              <div className="sw-loading" role="status">
                Finding your opportunities…
              </div>
            ) : feedError ? (
              <div className="sw-empty">
                <Briefcase size={28} aria-hidden="true" />
                <h3>These opportunities couldn't be loaded</h3>
                <p>Use Try again above to refresh this list.</p>
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="sw-empty">
                <Briefcase size={28} aria-hidden="true" />
                <h3>{emptyState.title}</h3>
                <p>{emptyState.description}</p>
                <a href={emptyState.href} onClick={followLink} className="sw-btn sw-btn-secondary">
                  {emptyState.action}
                </a>
              </div>
            ) : (
              <div className="sw-vacancy-list">
                {displayedJobs.map((job) => (
                  <VacancyCard
                    key={job.id}
                    job={job}
                    saved={savedIds.has(job.id)}
                    saving={savingIds.has(job.id)}
                    saveDisabled={!!loadErrors.saved}
                    onSave={() => void toggleSaveJob(job.id)}
                    matchScore={activeTab === 'recommended' ? job.match_percentage : null}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="home-companies-heading" aria-busy={loading}>
            <div className="sw-section-heading">
              <div>
                <h2 id="home-companies-heading">Meet the companies hiring</h2>
                <p>Discover employers with open roles across the region.</p>
              </div>
              <a href="/people" onClick={followLink} className="sw-text-link">
                Explore companies <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            {loading ? (
              <p className="sw-loading">Loading companies…</p>
            ) : loadErrors.companies ? (
              <p className="sw-empty">
                Companies couldn't be loaded. Try refreshing the dashboard.
              </p>
            ) : companiesHiring.length === 0 ? (
              <p className="sw-empty">Companies with open vacancies will appear here.</p>
            ) : (
              <ul className="sw-company-list">
                {companiesHiring.map((company) => (
                  <li key={company.id}>
                    <a
                      href={`/people/${encodeURIComponent(company.id)}`}
                      onClick={followLink}
                      className="sw-company-link"
                    >
                      <span className="sw-company-avatar" aria-hidden="true">
                        <Building2 size={20} />
                      </span>
                      <div className="sw-company-info">
                        <strong>{company.company_name}</strong>
                        <p>{[company.industry, company.province].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="sw-company-openings">
                        {company.open_jobs} open {company.open_jobs === 1 ? 'role' : 'roles'}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="sw-sidebar" aria-label="Your job search overview">
          <section className="sw-sidebar-section" aria-labelledby="home-applications-heading">
            <h2 id="home-applications-heading">
              <FileCheck2 size={19} aria-hidden="true" /> Your applications
            </h2>
            {loading ? (
              <p>Loading application activity…</p>
            ) : !homeData ? (
              <p>Your application activity couldn't be loaded.</p>
            ) : totalApps === 0 ? (
              <p>
                Your next chapter starts with an application. Track its progress here once you
                apply.
              </p>
            ) : (
              <dl className="sw-summary-list">
                {appCounts
                  .filter((application) => application.count > 0)
                  .map((application) => (
                    <div key={application.status}>
                      <dt>{statusLabels[application.status]}</dt>
                      <dd>{application.count}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <a href="/applications" onClick={followLink} className="sw-text-link">
              View applications <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>

          <section className="sw-sidebar-section" aria-labelledby="home-career-heading">
            <h2 id="home-career-heading">
              <TrendingUp size={19} aria-hidden="true" /> Build your next step
            </h2>
            <dl className="sw-summary-list">
              <div>
                <dt>Profile complete</dt>
                <dd>{completion === null ? 'Unavailable' : `${completion}%`}</dd>
              </div>
            </dl>
            {completion !== null && (
              <progress
                className="sw-profile-progress"
                value={completion}
                max={100}
                aria-label="Profile completion"
              >
                {completion}%
              </progress>
            )}
            <dl className="sw-summary-list">
              <div>
                <dt>Resume</dt>
                <dd>{loading ? 'Loading…' : resumeStatus}</dd>
              </div>
              <div>
                <dt>Skills assessment</dt>
                <dd>
                  {loading
                    ? 'Loading…'
                    : homeData
                      ? `${homeData.skills_gap.evaluated_jobs} ${homeData.skills_gap.evaluated_jobs === 1 ? 'role' : 'roles'} reviewed`
                      : 'Unavailable'}
                </dd>
              </div>
            </dl>
            <a href="/career" onClick={followLink} className="sw-btn sw-btn-secondary">
              Explore career tools <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>

          <section className="sw-sidebar-section" aria-labelledby="home-profile-tip-heading">
            <h2 id="home-profile-tip-heading">Help employers get to know you</h2>
            <p>
              Add your skills, experience, and preferred role so your profile reflects what you can
              offer.
            </p>
            <a href="/profile" onClick={followLink} className="sw-text-link">
              Update your profile <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
