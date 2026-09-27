import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  MapPin,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { MatchBadge } from '@/components/MatchBadge';
import { SkillTag } from '@/components/SkillTag';
import type { Job } from '@/types/job';

type JobDetailsModalProps = {
  job: Job | null;
  onClose: () => void;
  onApply: (job: Job) => void;
  onSave: (job: Job) => void;
  onMatch: () => void;
  isSaved: boolean;
  feedback: string;
};

export function JobDetailsModal({
  job,
  onClose,
  onApply,
  onSave,
  onMatch,
  isSaved,
  feedback,
}: JobDetailsModalProps) {
  return (
    <Modal
      isOpen={job !== null}
      onClose={onClose}
      titleId="job-details-title"
      descriptionId="job-details-sample"
      className="job-details-modal"
    >
      {job && (
        <>
          <header className="job-modal-bar">
            <span>
              Job details <span className="modal-bar-divider">/</span> MIMAROPA Works
            </span>
            <button
              data-modal-close
              className="modal-close"
              onClick={onClose}
              aria-label="Close job details"
            >
              <X size={22} />
            </button>
          </header>
          <div className="job-details-scroll">
            <div className="job-details-inner">
              <div className="job-detail-topline">
                <span className="job-detail-label">SAMPLE OPPORTUNITY</span>
                <MatchBadge score={job.match} />
              </div>
              <div className="job-detail-identity">
                <span className={`company-logo company-${job.companyColor}`} aria-hidden="true">
                  {job.companyInitials}
                </span>
                <div>
                  <h2 id="job-details-title">{job.title}</h2>
                  <p>{job.company}</p>
                </div>
              </div>
              <div className="job-detail-meta">
                <span>
                  <MapPin size={19} aria-hidden="true" />
                  {job.city}, {job.province}
                </span>
                <span>
                  <BriefcaseBusiness size={19} aria-hidden="true" />
                  {job.type}
                </span>
                <strong>{job.salary}</strong>
                <span className="job-posted">
                  <CalendarDays size={18} aria-hidden="true" />
                  {job.postedLabel}
                </span>
              </div>
              <div className="job-detail-actions">
                <button className="button button-primary" onClick={() => onApply(job)}>
                  Quick Apply
                </button>
                <button
                  className={`button button-secondary ${isSaved ? 'job-is-saved' : ''}`}
                  aria-pressed={isSaved}
                  onClick={() => onSave(job)}
                >
                  {isSaved ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
                  {isSaved ? 'Saved' : 'Save Job'}
                </button>
              </div>
              <p className="job-action-feedback" role="status" aria-live="polite">
                {feedback ||
                  (isSaved ? 'Saved for this session. You can find it under Saved jobs.' : '')}
              </p>
              <div className="job-detail-columns">
                <div className="job-description-sections">
                  <section aria-labelledby="job-about-heading">
                    <h3 id="job-about-heading">About the opportunity</h3>
                    <p>{job.description}</p>
                  </section>
                  <section aria-labelledby="job-duties-heading">
                    <h3 id="job-duties-heading">What you will do</h3>
                    <ul>
                      {job.responsibilities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                  <section aria-labelledby="job-qualifications-heading">
                    <h3 id="job-qualifications-heading">What we’re looking for</h3>
                    <ul>
                      {job.qualifications.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                  <section aria-labelledby="job-skills-heading">
                    <h3 id="job-skills-heading">Skills that could be a great fit</h3>
                    <div className="skill-tags">
                      {job.skills.map((skill) => (
                        <SkillTag key={skill}>{skill}</SkillTag>
                      ))}
                    </div>
                  </section>
                </div>
                <aside className="job-match-panel" aria-labelledby="job-match-heading">
                  <div className="match-panel-title">
                    <span>
                      <Check size={20} aria-hidden="true" />
                    </span>
                    <h3 id="job-match-heading">How you match</h3>
                  </div>
                  <p>
                    This example shows how skills, experience, education, and location could
                    contribute to a match.
                  </p>
                  <div className="detail-match-factors">
                    {Object.entries(job.matchBreakdown).map(([factor, score]) => (
                      <div className="detail-match-factor" key={factor}>
                        <div>
                          <label htmlFor={`match-${factor}`}>{factor} match</label>
                          <strong>{score}%</strong>
                        </div>
                        <meter id={`match-${factor}`} min={0} max={100} value={score}>
                          {score}%
                        </meter>
                      </div>
                    ))}
                  </div>
                  <p className="match-panel-note">
                    Sample breakdown. These scores are not based on your profile.
                  </p>
                  <button className="text-link" onClick={onMatch}>
                    Explore personalized matching
                  </button>
                  <p className="match-decision-note">
                    <ShieldCheck size={19} aria-hidden="true" />
                    Match scores are a guide. Final hiring decisions remain with the employer.
                  </p>
                </aside>
              </div>
              <p id="job-details-sample" className="job-sample-disclosure">
                This is a sample listing. Applications are not sent to an employer, and saved jobs
                stay in this browser session only.
              </p>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
