import { Bookmark, ArrowUpRight, MapPin, BriefcaseBusiness } from 'lucide-react';
import { navigate } from '@/auth/navigation';
import type { SeekerJob } from '@/types/seeker';
import type { RecommendedVacancy } from '@/types/career';

interface VacancyCardProps {
  job: SeekerJob | RecommendedVacancy;
  saved: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  onSave: () => void;
  headingLevel?: 2 | 3;
  matchScore?: number | null;
  showDescription?: boolean;
}

export function VacancyCard({
  job,
  saved,
  saving = false,
  saveDisabled = false,
  onSave,
  headingLevel = 3,
  matchScore = job.match_percentage,
  showDescription = false,
}: VacancyCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const skills = job.matched_skills?.length ? job.matched_skills : job.required_skills || [];
  const posted = new Date(Number(job.created_at));
  const validDate = Number.isFinite(posted.getTime());
  return (
    <article className="sw-vacancy">
      <div className="sw-vacancy-heading">
        <span className="sw-company-avatar" aria-hidden="true">
          {job.company_name?.charAt(0).toUpperCase() || 'M'}
        </span>
        <div className="sw-vacancy-title">
          <p className="sw-vacancy-company">{job.company_name}</p>
          <Heading>
            <a
              href={`/jobs/${encodeURIComponent(job.id)}`}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                navigate(`/jobs/${encodeURIComponent(job.id)}`);
              }}
            >
              {job.title}
            </a>
          </Heading>
        </div>
        <button
          type="button"
          className={`sw-save-button${saved ? ' is-saved' : ''}`}
          aria-label={`${saved ? 'Unsave' : 'Save'} ${job.title}`}
          aria-pressed={saved}
          disabled={saving || saveDisabled}
          onClick={onSave}
        >
          <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <div className="sw-vacancy-meta">
        <span>
          <MapPin size={15} aria-hidden="true" />
          {[job.municipality, job.province].filter(Boolean).join(', ')}
        </span>
        <span>
          <BriefcaseBusiness size={15} aria-hidden="true" />
          {[job.employment_type, job.work_setup].filter(Boolean).join(' · ')}
        </span>
      </div>
      {job.salary_min != null && (
        <p className="sw-vacancy-salary">
          ₱{Number(job.salary_min).toLocaleString('en-PH')}
          {job.salary_max != null &&
            job.salary_max !== job.salary_min &&
            ` – ₱${Number(job.salary_max).toLocaleString('en-PH')}`}
        </p>
      )}
      {showDescription && 'description' in job && job.description && (
        <p className="sw-vacancy-description">{job.description}</p>
      )}
      {skills.length > 0 && (
        <ul className="sw-vacancy-skills" aria-label="Job skills">
          {skills.slice(0, 3).map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
          {skills.length > 3 && <li>+{skills.length - 3} more</li>}
        </ul>
      )}
      <div className="sw-vacancy-footer">
        {matchScore != null && Number.isFinite(matchScore) ? (
          <span className="sw-match-score">
            <span aria-hidden="true" />
            {Math.round(matchScore)}% match
          </span>
        ) : validDate ? (
          <time dateTime={posted.toISOString()}>
            Posted {posted.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          </time>
        ) : (
          <span>Open opportunity</span>
        )}
        <span className="sw-vacancy-action" aria-hidden="true">
          View opportunity <ArrowUpRight size={16} />
        </span>
      </div>
    </article>
  );
}
