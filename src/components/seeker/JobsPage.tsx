import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Search, MapPin, Briefcase, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { api } from '@/auth/api';
import { navigate, useLocation } from '@/auth/navigation';
import type { ProfessionalProfile, SeekerJob } from '@/types/seeker';
import type { SeekerHomeResponse } from '@/types/career';
import { VacancyCard } from './VacancyCard';
import { ListPagination } from './ListPagination';

const PROVINCES = ['Oriental Mindoro', 'Occidental Mindoro', 'Marinduque', 'Romblon', 'Palawan'];
const WORK_SETUPS = ['On-site', 'Hybrid', 'Remote'];
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const TABS = [
  { id: 'all', label: 'All jobs' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'latest', label: 'Latest' },
  { id: 'nearby', label: 'In your province' },
  { id: 'remote', label: 'Remote' },
  { id: 'saved', label: 'Saved' },
] as const;
type Tab = (typeof TABS)[number]['id'];
type LoadErrors = { jobs: boolean; recommended: boolean; saved: boolean; profile: boolean };
const NO_ERRORS: LoadErrors = { jobs: false, recommended: false, saved: false, profile: false };

function validOption(value: string | null, options: readonly string[]) {
  return options.find((option) => option.toLowerCase() === value?.toLowerCase()) || '';
}

export function JobsPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.split('?')[1]?.split('#')[0] || '');
  const searchKeyword = params.get('q') || '';
  const searchLocation = params.get('loc') || '';
  const requestedPage = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const selectedProvince = validOption(params.get('province'), PROVINCES);
  const selectedSetup = validOption(params.get('setup'), WORK_SETUPS);
  const selectedType = validOption(params.get('type'), JOB_TYPES);
  const selectedTab = (validOption(
    params.get('tab'),
    TABS.map((tab) => tab.id),
  ) || 'all') as Tab;

  const [jobs, setJobs] = useState<SeekerJob[]>([]);
  const [recommendations, setRecommendations] = useState<Map<string, number>>(new Map());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const savingRef = useRef(new Set<string>());
  const [userProvince, setUserProvince] = useState('');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<LoadErrors>(NO_ERRORS);
  const [saveError, setSaveError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [jobsResult, homeResult, savedResult, profileResult] = await Promise.allSettled([
        api<{ jobs: SeekerJob[] }>('/discovery/jobs'),
        api<SeekerHomeResponse>('/job-seeker/home'),
        api<{ job_ids: string[] }>('/saved-jobs'),
        api<{ profile: ProfessionalProfile }>('/job-seeker/professional-profile'),
      ]);
      if (!active) return;
      setJobs(jobsResult.status === 'fulfilled' ? jobsResult.value.jobs : []);
      setRecommendations(
        homeResult.status === 'fulfilled'
          ? new Map(homeResult.value.recommendations.map((job) => [job.id, job.match_percentage]))
          : new Map(),
      );
      if (savedResult.status === 'fulfilled') setSavedIds(new Set(savedResult.value.job_ids));
      setUserProvince(
        profileResult.status === 'fulfilled' ? profileResult.value.profile.province.trim() : '',
      );
      setErrors({
        jobs: jobsResult.status === 'rejected',
        recommended: homeResult.status === 'rejected',
        saved: savedResult.status === 'rejected',
        profile: profileResult.status === 'rejected',
      });
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const retry = () => {
    setLoading(true);
    setErrors(NO_ERRORS);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const updateFilters = (changes: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search);
    if (!Object.hasOwn(changes, 'page')) next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value.trim() && !(key === 'tab' && value === 'all')) next.set(key, value.trim());
      else next.delete(key);
    }
    const query = next.toString();
    navigate(`/jobs${query ? `?${query}` : ''}`);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateFilters({ q: String(form.get('q') || ''), loc: String(form.get('loc') || '') });
  };

  const toggleSave = async (job: SeekerJob) => {
    if (savingRef.current.has(job.id) || loading || errors.saved) return;
    const wasSaved = savedIds.has(job.id);
    savingRef.current.add(job.id);
    setSavingIds(new Set(savingRef.current));
    setSaveError('');
    setSavedIds((previous) => {
      const next = new Set(previous);
      if (wasSaved) next.delete(job.id);
      else next.add(job.id);
      return next;
    });
    try {
      await api(`/saved-jobs/${encodeURIComponent(job.id)}`, {}, wasSaved ? 'DELETE' : 'PUT');
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: wasSaved ? 'Job removed from saved.' : 'Job saved to your list.' },
        }),
      );
    } catch {
      setSavedIds((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.add(job.id);
        else next.delete(job.id);
        return next;
      });
      setSaveError(
        `We couldn't ${wasSaved ? 'remove' : 'save'} “${job.title}”. Your saved list is unchanged. Try the bookmark again.`,
      );
    } finally {
      savingRef.current.delete(job.id);
      setSavingIds(new Set(savingRef.current));
    }
  };

  const filteredJobs = useMemo(() => {
    const words = searchKeyword.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const locationQuery = searchLocation.toLowerCase().trim();
    const results = jobs.filter((job) => {
      const searchable = [
        job.title,
        job.company_name,
        job.industry,
        job.description,
        ...(job.required_skills || []),
        ...(job.preferred_skills || []),
      ]
        .join(' ')
        .toLowerCase();
      if (!words.every((word) => searchable.includes(word))) return false;
      if (
        locationQuery &&
        !`${job.municipality} ${job.province}`.toLowerCase().includes(locationQuery)
      )
        return false;
      if (selectedProvince && job.province?.toLowerCase() !== selectedProvince.toLowerCase())
        return false;
      if (selectedSetup && job.work_setup?.toLowerCase() !== selectedSetup.toLowerCase())
        return false;
      if (selectedType && job.employment_type?.toLowerCase() !== selectedType.toLowerCase())
        return false;
      if (selectedTab === 'recommended') return recommendations.has(job.id);
      if (selectedTab === 'nearby')
        return Boolean(userProvince) && job.province?.toLowerCase() === userProvince.toLowerCase();
      if (selectedTab === 'remote') return job.work_setup?.toLowerCase() === 'remote';
      if (selectedTab === 'saved') return savedIds.has(job.id);
      return true;
    });
    // Newest first for browsing; recommendations put the strongest match first.
    return results.sort((a, b) => {
      if (selectedTab === 'recommended') {
        const scoreDifference = (recommendations.get(b.id) || 0) - (recommendations.get(a.id) || 0);
        if (scoreDifference) return scoreDifference;
      }
      return (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
    });
  }, [
    jobs,
    searchKeyword,
    searchLocation,
    selectedProvince,
    selectedSetup,
    selectedType,
    selectedTab,
    recommendations,
    userProvince,
    savedIds,
  ]);

  const pageSize = 20;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(filteredJobs.length / pageSize)));
  const filterCount = [selectedProvince, selectedSetup, selectedType].filter(Boolean).length;
  const hasSearchFilters = Boolean(searchKeyword.trim() || searchLocation.trim() || filterCount);
  const hasActiveFilters = hasSearchFilters || selectedTab !== 'all';
  const activeError = errors.jobs
    ? 'Job listings could not load. Check your connection and try again.'
    : selectedTab === 'recommended' && errors.recommended
      ? 'Your recommendations could not load. Retry to see jobs matched to your profile.'
      : selectedTab === 'saved' && errors.saved
        ? 'Your saved jobs could not load. Retry to get your saved list.'
        : selectedTab === 'nearby' && errors.profile
          ? 'Your profile location could not load. Retry to see jobs in your province.'
          : '';
  const needsProvince = selectedTab === 'nearby' && !userProvince && !errors.profile;

  return (
    <div className="sw-page sw-jobs-page">
      <header>
        <h1 className="sw-page-title">Find your next opportunity.</h1>
        <p className="sw-page-description">
          Explore jobs across MIMAROPA. Find the role, place, and way of working that fit you.
        </p>
      </header>

      <section className="sw-search-panel" aria-label="Search jobs">
        <form
          key={`${searchKeyword}\u0000${searchLocation}`}
          className="sw-search-form"
          onSubmit={submitSearch}
          role="search"
          aria-label="Job search"
        >
          <div className="sw-search-field">
            <label htmlFor="jobs-keyword">What are you looking for?</label>
            <div className="sw-search-input">
              <Search size={19} aria-hidden="true" />
              <input
                id="jobs-keyword"
                name="q"
                type="search"
                placeholder="Job title, company, or skill"
                defaultValue={searchKeyword}
              />
            </div>
          </div>
          <div className="sw-search-field">
            <label htmlFor="jobs-location">Where?</label>
            <div className="sw-search-input">
              <MapPin size={19} aria-hidden="true" />
              <input
                id="jobs-location"
                name="loc"
                type="search"
                placeholder="City, municipality, or province"
                defaultValue={searchLocation}
              />
            </div>
          </div>
          <button type="submit" className="sw-btn sw-btn-primary">
            <Search size={17} aria-hidden="true" />
            Find jobs
          </button>
        </form>
      </section>

      <div className="sw-discovery-tabs" role="group" aria-label="Browse jobs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selectedTab === tab.id}
            className={selectedTab === tab.id ? 'is-active' : ''}
            onClick={() => updateFilters({ tab: tab.id })}
          >
            {tab.label}
            {tab.id === 'saved' && !loading && !errors.saved ? ` (${savedIds.size})` : ''}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="sw-btn sw-btn-secondary sw-filter-toggle"
        aria-expanded={showMobileFilters}
        aria-controls="job-filters"
        onClick={() => setShowMobileFilters((open) => !open)}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        {showMobileFilters ? 'Hide filters' : 'Filters'}
        {filterCount ? ` (${filterCount})` : ''}
      </button>

      <div className="sw-jobs-layout">
        <aside
          id="job-filters"
          className={`sw-filters${showMobileFilters ? ' is-open' : ''}`}
          aria-labelledby="job-filters-title"
        >
          <div className="sw-section-heading">
            <h2 id="job-filters-title">Refine your search</h2>
          </div>
          <div className="sw-filter-field">
            <label htmlFor="jobs-province">Province</label>
            <select
              id="jobs-province"
              value={selectedProvince}
              onChange={(event) => updateFilters({ province: event.target.value })}
            >
              <option value="">All provinces</option>
              {PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
          <div className="sw-filter-field">
            <label htmlFor="jobs-setup">Work setup</label>
            <select
              id="jobs-setup"
              value={selectedSetup}
              onChange={(event) => updateFilters({ setup: event.target.value })}
            >
              <option value="">All work setups</option>
              {WORK_SETUPS.map((setup) => (
                <option key={setup} value={setup}>
                  {setup}
                </option>
              ))}
            </select>
          </div>
          <div className="sw-filter-field">
            <label htmlFor="jobs-type">Job type</label>
            <select
              id="jobs-type"
              value={selectedType}
              onChange={(event) => updateFilters({ type: event.target.value })}
            >
              <option value="">All job types</option>
              {JOB_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="sw-btn sw-btn-secondary"
              onClick={() => navigate('/jobs')}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Clear all filters
            </button>
          )}
        </aside>

        <section
          className="sw-feed sw-results"
          aria-labelledby="jobs-results-title"
          aria-busy={loading}
        >
          <div className="sw-section-heading">
            <div>
              <h2 id="jobs-results-title" aria-live="polite">
                {loading
                  ? 'Loading opportunities…'
                  : activeError || needsProvince
                    ? 'Job opportunities'
                    : `${filteredJobs.length} ${filteredJobs.length === 1 ? 'opportunity' : 'opportunities'}${hasSearchFilters ? ' found' : ''}`}
              </h2>
              {!loading && !activeError && !needsProvince && filteredJobs.length > 0 && (
                <p>
                  {selectedTab === 'recommended'
                    ? 'Highest matches first'
                    : selectedTab === 'nearby'
                      ? `${userProvince} · Newest first`
                      : 'Newest first'}
                </p>
              )}
            </div>
          </div>

          {saveError && (
            <div className="sw-alert" role="alert">
              {saveError}
            </div>
          )}
          {!loading && errors.saved && selectedTab !== 'saved' && !errors.jobs && (
            <div className="sw-alert" role="alert">
              <p>Saved jobs could not load. Retry to save or remove jobs.</p>
              <button type="button" className="sw-btn sw-btn-secondary sw-btn-sm" onClick={retry}>
                Retry saved jobs
              </button>
            </div>
          )}

          {loading ? (
            <div className="sw-empty" role="status">
              <p>Loading job opportunities…</p>
            </div>
          ) : activeError ? (
            <div className="sw-empty" role="alert">
              <h3>We couldn't load these opportunities</h3>
              <p>{activeError}</p>
              <button type="button" className="sw-btn sw-btn-primary" onClick={retry}>
                Try again
              </button>
            </div>
          ) : needsProvince ? (
            <div className="sw-empty">
              <MapPin size={28} aria-hidden="true" />
              <h3>Add your province to discover local jobs</h3>
              <p>Your profile location helps us show opportunities in your province.</p>
              <a
                className="sw-btn sw-btn-primary"
                href="/profile"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  navigate('/profile');
                }}
              >
                Update your profile
              </a>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="sw-empty">
              <Briefcase size={28} aria-hidden="true" />
              <h3>
                {selectedTab === 'saved' && !hasSearchFilters
                  ? 'Your saved jobs will appear here'
                  : selectedTab === 'recommended' && !hasSearchFilters
                    ? 'No recommendations yet'
                    : 'No opportunities found'}
              </h3>
              <p>
                {hasSearchFilters
                  ? 'Try a different keyword or remove a filter to see more opportunities.'
                  : selectedTab === 'saved'
                    ? 'Use the bookmark on a job to keep it for later.'
                    : selectedTab === 'recommended'
                      ? 'Explore all jobs while new opportunities become available. You can also update your profile to keep your skills and preferences current.'
                      : selectedTab === 'nearby'
                        ? `There are no open jobs in ${userProvince} right now. Explore opportunities across MIMAROPA.`
                        : 'There are no jobs to show here right now. Check back for new opportunities.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="sw-btn sw-btn-primary"
                  onClick={() => navigate('/jobs')}
                >
                  {hasSearchFilters ? 'Clear filters' : 'Browse all jobs'}
                </button>
              )}
            </div>
          ) : (
            filteredJobs
              .slice((page - 1) * pageSize, page * pageSize)
              .map((job) => (
                <VacancyCard
                  key={job.id}
                  job={job}
                  saved={savedIds.has(job.id)}
                  saving={savingIds.has(job.id) || errors.saved}
                  onSave={() => void toggleSave(job)}
                  matchScore={recommendations.get(job.id) ?? job.match_percentage}
                  headingLevel={3}
                  showDescription
                />
              ))
          )}
          {!loading && !activeError && !needsProvince && (
            <ListPagination
              page={page}
              total={filteredJobs.length}
              pageSize={pageSize}
              onChange={(next) => {
                updateFilters({ page: String(next) });
                window.scrollTo({ top: 0 });
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
