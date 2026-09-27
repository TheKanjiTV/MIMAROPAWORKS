import { ArrowUpRight, Facebook, Heart, Linkedin } from 'lucide-react';
import { Brand } from '@/components/Brand';
import type { PreviewAction } from '@/types/landing';

export function Footer({ onAction }: { onAction: PreviewAction }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Brand />
            <p>
              Local talent. Meaningful connections.
              <br />A brighter future for MIMAROPA.
            </p>
            <div className="footer-social">
              <button
                className="icon-button"
                aria-label="Facebook community preview"
                onClick={() => onAction('social')}
              >
                <Facebook size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="LinkedIn community preview"
                onClick={() => onAction('social')}
              >
                <Linkedin size={17} />
              </button>
            </div>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <a href="#about">About us</a>
            <a href="#jobs">Find jobs</a>
            <a href="#employers">For employers</a>
          </nav>
          <nav aria-label="Resources">
            <h2>Let’s connect</h2>
            <button onClick={() => onAction('contact')}>
              Contact <ArrowUpRight size={12} />
            </button>
            <button onClick={() => onAction('privacy')}>Privacy policy</button>
            <button onClick={() => onAction('terms')}>Terms of service</button>
          </nav>
          <div className="footer-project">
            <span className="footer-project-icon">
              <Heart size={20} />
            </span>
            <strong>
              Built with purpose.
              <br />
              Made for our communities.
            </strong>
            <span>Developed for MinSU InnoHack</span>
            <span className="impact-tag">AI for Social Impact</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MIMAROPA Works. An InnoHack project.</span>
          <span>
            <span className="note-dot" /> Find work closer to home.
          </span>
        </div>
      </div>
    </footer>
  );
}
