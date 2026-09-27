import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  HeartHandshake,
  MapPin,
  ScanSearch,
  Sparkles,
  Users,
} from 'lucide-react';
import './community-sections.css';

const provinces = ['Oriental Mindoro', 'Occidental Mindoro', 'Marinduque', 'Romblon', 'Palawan'];

export function ImpactSection() {
  return (
    <section className="community-impact" id="about" aria-labelledby="impact-heading">
      <div className="container">
        <div className="community-impact-grid">
          <div className="community-impact-copy">
            <p className="section-eyebrow">
              <HeartHandshake size={16} aria-hidden="true" /> LOCAL EMPLOYMENT
            </p>
            <h2 className="section-heading" id="impact-heading">
              Creating opportunities
              <br className="community-desktop-break" /> across <span>MIMAROPA.</span>
            </h2>
            <p className="community-impact-description">Local work should be easier to find.</p>
            <p className="community-impact-body">
              Many job seekers leave their communities because local opportunities can be difficult
              to discover. We aim to make employment more accessible by connecting local talent with
              local employers through intelligent job matching.
            </p>
            <a className="text-link community-impact-link" href="#jobs">
              Discover local opportunities <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>

          <div className="community-region" aria-labelledby="region-heading">
            <div className="community-region-heading">
              <span className="community-region-icon">
                <MapPin size={24} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <div>
                <h3 id="region-heading">One region. Five provinces.</h3>
                <p>Explore work across MIMAROPA.</p>
              </div>
            </div>
            <ul className="community-provinces" aria-label="Our five provinces">
              {provinces.map((province) => (
                <li className="community-province" key={province}>
                  <MapPin size={17} aria-hidden="true" />
                  <span>{province}</span>
                </li>
              ))}
            </ul>
            <p className="community-region-caption">
              Search by city or province to find opportunities near you.
            </p>
          </div>
        </div>

        <div className="community-impact-values" aria-label="Our regional focus">
          <div className="community-impact-value">
            <span className="community-value-number">5</span>
            <span>Provinces</span>
          </div>
          <div className="community-impact-value">
            <BriefcaseBusiness size={23} strokeWidth={1.6} aria-hidden="true" />
            <span>Local opportunities</span>
          </div>
          <div className="community-impact-value">
            <Users size={24} strokeWidth={1.6} aria-hidden="true" />
            <span>Local talent</span>
          </div>
          <div className="community-impact-value">
            <Sparkles size={23} strokeWidth={1.6} aria-hidden="true" />
            <span>AI-powered matching</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const employerBenefits = [
  {
    icon: Users,
    title: 'Reach local applicants',
    description: 'Help applicants nearby discover your openings.',
  },
  {
    icon: Sparkles,
    title: 'AI-assisted matching',
    description: 'Find candidates with skills relevant to your role.',
  },
  {
    icon: Check,
    title: 'Simplified recruitment',
    description: 'Make your requirements clear from the start.',
  },
  {
    icon: ScanSearch,
    title: 'Location-based discovery',
    description: 'Reach talent in your city and province.',
  },
];

export function EmployerSection({ onAction }: { onAction: (kind: 'employer') => void }) {
  return (
    <section
      className="community-employer-section"
      id="employers"
      aria-labelledby="employer-heading"
    >
      <div className="container">
        <div className="community-employer-panel">
          <div className="community-employer-copy">
            <p className="section-eyebrow">
              <Building2 size={16} aria-hidden="true" /> FOR LOCAL EMPLOYERS
            </p>
            <h2 className="section-heading" id="employer-heading">
              Find the right talent
              <br />
              in MIMAROPA.
            </h2>
            <p>
              Post opportunities and connect with candidates whose skills, experience, and location
              match your requirements.
            </p>
            <button
              className="button button-white community-employer-button"
              type="button"
              onClick={() => onAction('employer')}
            >
              Post a Job <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
          <ul className="community-employer-benefits">
            {employerBenefits.map(({ icon: Icon, title, description }) => (
              <li key={title}>
                <span className="community-employer-icon">
                  <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function FinalCTA({ onAction }: { onAction: (kind: 'job-seeker' | 'employer') => void }) {
  return (
    <section className="community-final-cta" id="get-started" aria-labelledby="final-cta-heading">
      <div className="container">
        <span className="community-cta-symbol">
          <Sparkles size={24} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <p className="section-eyebrow">GET STARTED WITH MIMAROPA WORKS</p>
        <h2 className="section-heading" id="final-cta-heading">
          Your next opportunity might be
          <br className="community-desktop-break" /> closer than you think.
        </h2>
        <p>Connect with opportunities, employers, and local talent across MIMAROPA.</p>
        <div className="community-final-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={() => onAction('job-seeker')}
          >
            Create Job Seeker Account <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => onAction('employer')}
          >
            Register as Employer
          </button>
        </div>
        <p className="community-cta-footnote">
          <MapPin size={16} aria-hidden="true" /> Built for job seekers and employers in MIMAROPA.
        </p>
      </div>
    </section>
  );
}
