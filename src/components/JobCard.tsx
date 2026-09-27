import { ArrowUpRight, BookmarkCheck, BriefcaseBusiness, MapPin } from 'lucide-react';
import { MatchBadge } from '@/components/MatchBadge';
import { SkillTag } from '@/components/SkillTag';
import type { Job } from '@/types/job';

export function JobCard({
  job,
  onOpen,
  isSaved,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  isSaved: boolean;
}) {
  return (
    <article className="opportunity-card">
      <div className="opportunity-card-top">
        <span className={`company-logo company-${job.companyColor}`} aria-hidden="true">
          {job.companyInitials}
        </span>
        <MatchBadge score={job.match} />
      </div>
      <h3>
        <button
          className="job-title-button"
          onClick={() => onOpen(job)}
          aria-label={`Open ${job.title} at ${job.company}`}
          aria-haspopup="dialog"
        >
          {job.title}
        </button>
      </h3>
      <p className="opportunity-company">{job.company}</p>
      <div className="opportunity-meta">
        <span>
          <MapPin size={17} aria-hidden="true" />
          {job.city}, {job.province}
        </span>
        <span>
          <BriefcaseBusiness size={17} aria-hidden="true" />
          {job.type}
        </span>
      </div>
      <p className="opportunity-salary">{job.salary}</p>
      <p className="opportunity-summary">{job.description.split('. ')[0]}.</p>
      <div className="skill-tags">
        {job.skills.slice(0, 3).map((skill) => (
          <SkillTag key={skill}>{skill}</SkillTag>
        ))}
      </div>
      <div className="opportunity-card-footer">
        <span>{job.postedLabel}</span>
        {isSaved ? (
          <span className="card-saved">
            <BookmarkCheck size={17} aria-hidden="true" />
            Saved
          </span>
        ) : (
          <ArrowUpRight size={20} aria-hidden="true" />
        )}
      </div>
    </article>
  );
}
