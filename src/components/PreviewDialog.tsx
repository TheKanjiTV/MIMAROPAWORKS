import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CircleUserRound, X } from 'lucide-react';
import { Modal } from '@/components/Modal';
import type { PreviewAction, PreviewKind, PreviewState } from '@/types/landing';

const MESSAGES: Record<
  Exclude<PreviewKind, 'get-started'>,
  { title: string; description: string }
> = {
  login: {
    title: 'Sign in to MIMAROPA Works',
    description: 'Log in with your email or Google account to continue your profile setup.',
  },
  'job-seeker': {
    title: 'Find work that fits your life.',
    description:
      'Create your account, then add your location, education, skills, and work preferences. Documents and personalized matching are coming next.',
  },
  employer: {
    title: 'Find your next team member.',
    description:
      'Employer registration and job posting are coming soon. You’ll be able to share openings and connect with applicants from across MIMAROPA.',
  },
  contact: {
    title: 'Get in touch',
    description:
      'MIMAROPA Works is developed for MinSU InnoHack in the AI + Social Impact category. A public contact channel will be added before launch.',
  },
  privacy: {
    title: 'Your privacy in this preview',
    description:
      'We store your name, email, securely hashed password, and profile details on this app’s server. Google sign-in also stores your Google account ID and optional photo. Session cookies keep you signed in. Profile data is not sent to employers or an AI service in this prototype. Saved sample jobs remain temporary. Contact the project team for account or data removal. Google handles its own sign-in process.',
  },
  terms: {
    title: 'About this preview',
    description:
      'Registration creates a job seeker account and saves your profile. All jobs, companies, salaries, posting dates, and match scores are sample content. Applications, document submission, and AI matching are not yet available. Provide accurate details and do not misuse other accounts.',
  },
  social: {
    title: 'Stay connected',
    description:
      'Official Facebook and LinkedIn pages will be added when they’re ready. For now, explore the project and our vision for local employment.',
  },
};

export function PreviewDialog({
  preview,
  onClose,
  onAction,
}: {
  preview: PreviewState;
  onClose: () => void;
  onAction: PreviewAction;
}) {
  const explore = () => {
    onClose();
    document.getElementById('jobs')?.scrollIntoView();
  };
  return (
    <Modal
      isOpen={preview !== null}
      onClose={onClose}
      titleId="preview-title"
      descriptionId="preview-description"
      className="info-modal"
      focusKey={preview?.kind}
    >
      <button data-modal-close className="modal-close" onClick={onClose} aria-label="Close preview">
        <X size={21} />
      </button>
      <span className="dialog-eyebrow">MIMAROPA WORKS</span>
      {preview?.kind === 'get-started' ? (
        <>
          <h2 id="preview-title">How can we help?</h2>
          <p id="preview-description">Find an opportunity or connect with local talent.</p>
          <div className="account-choices">
            <button onClick={() => onAction('job-seeker')}>
              <CircleUserRound size={25} />
              <span>
                <strong>I’m looking for work</strong>
                <small>Explore jobs and save your favorites</small>
              </span>
              <ArrowUpRight size={20} />
            </button>
            <button onClick={() => onAction('employer')}>
              <BriefcaseBusiness size={25} />
              <span>
                <strong>I’m hiring</strong>
                <small>Learn about the employer preview</small>
              </span>
              <ArrowUpRight size={20} />
            </button>
          </div>
        </>
      ) : (
        preview && (
          <>
            <h2 id="preview-title">{MESSAGES[preview.kind].title}</h2>
            <p id="preview-description">{MESSAGES[preview.kind].description}</p>
            <button className="button button-primary" onClick={explore}>
              Browse sample jobs <ArrowRight size={17} />
            </button>
          </>
        )
      )}
    </Modal>
  );
}
