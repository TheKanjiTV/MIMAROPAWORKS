import { Bookmark, SearchX, SlidersHorizontal } from 'lucide-react';
import { JOB_CATEGORIES } from '@/data/jobs';
import { JobCard } from '@/components/JobCard';
import type { Job } from '@/types/job';
import '@/components/jobs.css';

type FeaturedJobsProps = {
  jobs: Job[];
  category: string;
  onCategory: (category: string) => void;
  onReset: () => void;
  onView: (job: Job) => void;
  isFiltered: boolean;
  savedIds: Set<string>;
  showSaved: boolean;
  onToggleSaved: () => void;
  onMatch: () => void;
};

export function FeaturedJobs({
  jobs,
  category,
  onCategory,
  onReset,
  onView,
  isFiltered,
  savedIds,
  showSaved,
  onToggleSaved,
  onMatch,
}: FeaturedJobsProps) {
  return (
    <section id="jobs" className="opportunities-section section-space" aria-labelledby="jobs-title">
      <div className="container">
        <div className="opportunities-heading">
          <p className="section-eyebrow">EXPLORE LOCAL OPPORTUNITIES</p>
          <h2 id="jobs-title" className="section-heading">
            {showSaved ? 'Your saved jobs' : 'Find your next job in MIMAROPA'}
          </h2>
          <p>
            Browse opportunities from across the region. Find a role that fits your skills and your
            life.
          </p>
        </div>
        <div className="browse-toolbar">
          <label className="category-filter">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span className="sr-only">Job category</span>
            <select value={category} onChange={(event) => onCategory(event.target.value)}>
              {JOB_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item === 'All opportunities' ? 'All job categories' : item}
                </option>
              ))}
            </select>
          </label>
          <button
            className={'saved-filter ' + (showSaved ? 'is-active' : '')}
            aria-pressed={showSaved}
            onClick={onToggleSaved}
          >
            <Bookmark size={18} aria-hidden="true" />
            Saved jobs <span>{savedIds.size}</span>
          </button>
          {(isFiltered || showSaved) && (
            <button className="clear-filter" onClick={onReset}>
              Clear filters
            </button>
          )}
          <span className="results-count" role="status" aria-live="polite">
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
            {isFiltered ? ' found' : ' to explore'}
          </span>
        </div>
        <p className="sample-listing-note">
          Sample listings for our InnoHack preview. Companies, salaries, posting dates, and match
          scores are illustrative.
        </p>
        {jobs.length > 0 ? (
          <div className="opportunities-grid">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onOpen={onView} isSaved={savedIds.has(job.id)} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchX size={36} aria-hidden="true" />
            <h3>{showSaved ? 'No saved jobs here yet' : 'No matching jobs yet'}</h3>
            <p>
              {showSaved
                ? 'Open a job and select Save Job to keep it here during this session.'
                : 'Try changing your search or location.'}
            </p>
            <button className="button button-primary" onClick={onReset}>
              Browse all sample jobs
            </button>
          </div>
        )}
        <div className="personalized-prompt">
          <div>
            <strong>A job search that starts with you.</strong>
            <p>Sign in to explore how skills and location can help you find a better fit.</p>
          </div>
          <button className="button button-secondary" onClick={onMatch}>
            See my matches
          </button>
        </div>
      </div>
    </section>
  );
}
