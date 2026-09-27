import { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness } from 'lucide-react';
import { api } from '@/auth/api';
import { handleNavigation } from '@/auth/navigation';
import type { SeekerHomeResponse } from '@/types/career';
import { VacancyCard } from './VacancyCard';

export function RecommendedJobsPage() {
  const [data, setData] = useState<SeekerHomeResponse | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [savedReady, setSavedReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      api<SeekerHomeResponse>('/job-seeker/home'),
      api<{ job_ids: string[] }>('/saved-jobs'),
    ]).then(([home, saved]) => {
      if (!active) return;
      if (home.status === 'fulfilled') setData(home.value);
      else setError('Your recommendations could not be loaded. Please try again.');
      setSavedReady(saved.status === 'fulfilled');
      if (saved.status === 'fulfilled') setSavedIds(new Set(saved.value.job_ids));
      else setSaveError('Your saved jobs could not be loaded. Retry to enable saving.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [retry]);

  const retryLoad = () => {
    setLoading(true);
    setError('');
    setSaveError('');
    setRetry((value) => value + 1);
  };

  const toggleSave = async (id: string) => {
    if (saving.has(id) || !savedReady) return;
    const wasSaved = savedIds.has(id);
    setSaving((previous) => new Set(previous).add(id));
    setSaveError('');
    try {
      await api(`/saved-jobs/${encodeURIComponent(id)}`, {}, wasSaved ? 'DELETE' : 'PUT');
      setSavedIds((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: wasSaved ? 'Job removed from saved.' : 'Job saved.' },
        }),
      );
    } catch {
      setSaveError('Could not update your saved jobs. Please try again.');
    } finally {
      setSaving((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="sw-page max-w-4xl mx-auto">
      <header>
        <a className="sw-text-link" href="/jobs" onClick={handleNavigation}>
          <ArrowLeft size={16} /> All jobs
        </a>
        <h1 className="sw-page-title">Recommended for you</h1>
        <p className="sw-page-description">
          Explore opportunities matched to your skills, experience, and location preferences. Open a
          job to see how you match.
        </p>
      </header>
      {(error || saveError) && (
        <div className="sw-alert" role="alert">
          <p>{error || saveError}</p>
          <button className="sw-btn sw-btn-secondary" onClick={retryLoad}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <div className="sw-loading" role="status">
          Loading your recommendations…
          <div className="sw-skeleton h-40" />
        </div>
      ) : (
        !error &&
        (data?.recommendations.length ? (
          <section className="sw-feed" aria-label="Recommended jobs">
            {data.recommendations.map((job) => (
              <VacancyCard
                key={job.id}
                job={job}
                headingLevel={2}
                saved={savedIds.has(job.id)}
                saving={saving.has(job.id)}
                saveDisabled={!savedReady}
                onSave={() => void toggleSave(job.id)}
              />
            ))}
          </section>
        ) : (
          <section className="sw-empty">
            <BriefcaseBusiness size={28} aria-hidden="true" />
            <h2>No recommendations yet</h2>
            <p>
              Keep your skills and job preferences up to date. You can still explore all available
              opportunities.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="/jobs" onClick={handleNavigation} className="sw-btn sw-btn-primary">
                Browse jobs
              </a>
              <a href="/profile" onClick={handleNavigation} className="sw-btn sw-btn-secondary">
                Review profile
              </a>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
