import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleUserRound,
  GraduationCap,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  {
    icon: CircleUserRound,
    title: 'Create your profile',
    description: 'Add your skills, education, experience, preferred field, and location.',
    color: 'blue',
  },
  {
    icon: ScanLine,
    title: 'Compare your experience',
    description: 'Our system will compare your profile with available job requirements.',
    color: 'teal',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Get recommended jobs',
    description: 'Discover recommended opportunities ranked by compatibility and proximity.',
    color: 'orange',
  },
];

export function MatchingSection() {
  return (
    <section
      id="matching"
      className="matching-section section-space"
      aria-labelledby="matching-title"
    >
      <div className="container">
        <div className="section-intro text-center">
          <p className="section-eyebrow">
            <Sparkles size={14} /> A SMARTER WAY TO FIND WORK
          </p>
          <h2 id="matching-title" className="section-heading">
            Jobs that match you.
            <br />
            <span className="heading-muted">Not just your search.</span>
          </h2>
          <p>
            More than keywords. Our matching system will connect your unique
            <br className="desktop-break" /> skills, experience, and location with the right
            opportunities.
          </p>
        </div>
        <div className="steps-grid">
          {STEPS.map((step, index) => (
            <article className="step-card" key={step.title}>
              <div className={`step-icon step-${step.color}`}>
                <step.icon size={25} strokeWidth={1.6} />
                <span>0{index + 1}</span>
              </div>
              {index < 2 && (
                <span className="step-connector" aria-hidden="true">
                  <span />
                  <ArrowRight size={17} />
                </span>
              )}
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
        <p className="section-note">
          <span className="note-dot" /> A look at what’s coming. Personalized matching will be
          available in a future release.
        </p>
      </div>
    </section>
  );
}

const FACTORS = [
  { label: 'Skills', value: 95, icon: Sparkles },
  { label: 'Education', value: 90, icon: GraduationCap },
  { label: 'Experience', value: 88, icon: BriefcaseBusiness },
  { label: 'Location', value: 100, icon: MapPin },
];

export function MatchScoreSection() {
  return (
    <section className="score-section section-space" aria-labelledby="score-title">
      <div className="container score-layout">
        <div className="score-explanation">
          <p className="section-eyebrow">
            <Sparkles size={14} /> BEHIND THE MATCH
          </p>
          <h2 id="score-title" className="section-heading">
            Understand your match
          </h2>
          <p>
            Our AI will consider multiple factors to recommend opportunities that better fit each
            applicant. See the factors behind each recommendation.
          </p>
          <div className="score-benefits">
            <span>
              <Check size={17} /> See what makes an opportunity a good fit
            </span>
            <span>
              <Check size={17} /> Find possibilities that fit your location
            </span>
          </div>
          <p className="hiring-note">
            <ShieldCheck size={19} /> AI helps make connections. Final hiring decisions always
            remain with employers.
          </p>
        </div>
        <div className="score-demo">
          <div className="score-demo-header">
            <span className="score-demo-label">
              <Sparkles size={17} /> Your match, explained
            </span>
            <span className="preview-label">Sample score</span>
          </div>
          <div className="score-demo-body">
            <div className="large-score-ring">
              <div>
                <strong>
                  94<span>%</span>
                </strong>
                <span>JOB MATCH</span>
              </div>
            </div>
            <div className="score-bars">
              {FACTORS.map(({ label, value, icon: Icon }) => (
                <div className="score-factor" key={label}>
                  <div>
                    <span>
                      <Icon size={13} />
                      {label}
                    </span>
                    <strong>{value}%</strong>
                  </div>
                  <div
                    className="score-track"
                    role="meter"
                    aria-label={`${label} match`}
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="score-demo-footer">
            <span>
              <span className="note-dot" /> Built around your potential
            </span>
            <span>Illustrative preview</span>
          </div>
        </div>
      </div>
    </section>
  );
}
