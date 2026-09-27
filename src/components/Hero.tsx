import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  HeartHandshake,
  MapPin,
  Navigation,
  Sparkles,
} from 'lucide-react';
import './hero.css';

export function Hero({ onMatch }: { onMatch: () => void }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <span className="hero-eyebrow-dot" aria-hidden="true" /> Local talent. Limitless
            potential.
          </p>
          <h1 id="hero-title">
            Find the right
            <br />
            opportunity
            <br />
            <span>near you.</span>
          </h1>
          <p className="hero-description">
            An AI-powered employment platform connecting job seekers and employers across{' '}
            <strong>MIMAROPA.</strong>
          </p>
          <p className="hero-detail">
            Find work based on your skills, experience, and location. Start your next chapter closer
            to home.
          </p>
          <div className="hero-buttons">
            <a className="button button-primary" href="#jobs">
              Find jobs <ArrowRight size={19} />
            </a>
            <a className="button button-secondary" href="#employers">
              For employers
            </a>
          </div>
          <p className="hero-trust">
            <HeartHandshake size={20} aria-hidden="true" /> Built for local talent and local
            communities.
          </p>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit" aria-hidden="true" />
          <span className="hero-spark" aria-hidden="true">
            <Sparkles size={28} />
          </span>
          <div className="hero-recommendation">
            <div className="recommendation-top">
              <span>
                <Sparkles size={17} aria-hidden="true" /> Recommended by AI
              </span>
              <span className="preview-label">Sample preview</span>
            </div>
            <div className="recommendation-company">
              <span className="company-logo company-teal">
                <BriefcaseBusiness size={27} aria-hidden="true" />
              </span>
              <div>
                <h2>Marketing Assistant</h2>
                <p>Isla Creative Co.</p>
              </div>
            </div>
            <p className="recommendation-location">
              <MapPin size={17} aria-hidden="true" />
              Calapan City, Oriental Mindoro
            </p>
            <div className="recommendation-tags">
              <span>Full-time</span>
              <span>On-site</span>
              <span>Marketing</span>
            </div>
            <div className="hero-score">
              <div>
                <strong>A great fit for you</strong>
                <div className="hero-match-value">
                  <span>
                    92<small>%</small>
                  </span>
                  <p>
                    AI match
                    <br />
                    <small>Illustrative score</small>
                  </p>
                </div>
              </div>
              <span className="hero-match-check" aria-hidden="true">
                <Check size={32} />
              </span>
            </div>
            <div className="match-factors">
              {['Skills', 'Education', 'Location'].map((factor) => (
                <span key={factor}>
                  <Check size={16} aria-hidden="true" />
                  {factor} match
                </span>
              ))}
            </div>
            <button className="recommendation-link" onClick={onMatch}>
              See jobs matched to me <ArrowRight size={18} />
            </button>
            <p className="recommendation-disclaimer">
              An example of how future recommendations will look.
            </p>
          </div>
          <span className="hero-place" aria-hidden="true">
            <MapPin size={22} /> Calapan City <i />
          </span>
          <div className="hero-local-note" aria-hidden="true">
            <Navigation size={29} />
            <div>
              <strong>Big possibilities. Shorter commutes.</strong>
              <p>Your next step could be close to home.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="container hero-bottom">
        <p>Made for our region. Built for your future.</p>
        <a href="#search" aria-label="Explore job search">
          <ArrowDown size={20} />
        </a>
      </div>
    </section>
  );
}
