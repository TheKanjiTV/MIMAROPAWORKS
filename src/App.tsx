import { useEffect, useState } from 'react';
import { SeekerHome } from '@/components/SeekerHome';
import { X } from 'lucide-react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { JobSearch } from '@/components/JobSearch';
import { MatchingSection, MatchScoreSection } from '@/components/MatchingSection';
import { FeaturedJobs } from '@/components/FeaturedJobs';
import { ImpactSection, EmployerSection, FinalCTA } from '@/components/CommunitySections';
import { Footer } from '@/components/Footer';
import { PreviewDialog } from '@/components/PreviewDialog';
import { JobDetailsModal } from '@/components/JobDetailsModal';
import { LoginModal } from '@/components/LoginModal';
import { useAuth } from '@/auth/useAuth';
import { JOBS } from '@/data/jobs';
import type { PreviewKind, PreviewState } from '@/types/landing';
import type { Job } from '@/types/job';
import type { AuthMode, AuthResult } from '@/types/auth';
import { navigate, useLocation } from '@/auth/navigation';
import { AccountPage } from '@/components/AccountPage';
import { EmployerWorkspace } from '@/components/EmployerWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

type PendingAction =
  { kind: 'save' | 'apply'; job: Job } | { kind: 'match' | 'signin' | 'saved-jobs' };
const MATCH_PREVIEW_MESSAGE =
  'Personalized matching is coming next. The scores shown here are sample previews, not an analysis of your Google profile.';
const APPLY_PREVIEW_MESSAGE =
  'You’re signed in. Applications will open in a future release; no application or personal information has been sent to this employer.';

export function App() {
  const location = useLocation().split('#', 1)[0];
  const rawPath = location.split(/[?#]/, 1)[0];
  const path = rawPath === '/admin.' ? '/admin' : rawPath;
  const { user, loading } = useAuth();
  useEffect(() => {
    if (rawPath === '/admin.') {
      navigate('/admin', { replace: true });
      return;
    }
    if (user && path === '/') {
      navigate(
        user.role === 'admin'
          ? '/admin'
          : user.role === 'employer'
            ? '/employer/dashboard'
            : !user.roleSelected
              ? '/onboarding/select-role'
              : user.profileCompletion < 100
                ? '/onboarding/job-seeker'
                : '/dashboard',
        { replace: true },
      );
    }
  }, [path, rawPath, user]);

  const isSeekerRoute =
    path === '/dashboard' ||
    path === '/jobs' ||
    path === '/jobs/recommended' ||
    path.startsWith('/jobs/') ||
    path === '/applications' ||
    path.startsWith('/applications/') ||
    path === '/people' ||
    path.startsWith('/people/') ||
    path === '/messages' ||
    path.startsWith('/messages/') ||
    path === '/notifications' ||
    path === '/career' ||
    path.startsWith('/career/') ||
    path === '/profile' ||
    path === '/profile/resume' ||
    path === '/settings';

  if ((path === '/admin' || path.startsWith('/admin/')) && path !== '/admin/login')
    return <AdminWorkspace key={location} path={path} />;
  if (path === '/dashboard' && user?.role === 'admin')
    return <AdminWorkspace key={location} path="/admin" />;
  if (path === '/dashboard' && user?.role === 'employer')
    return <EmployerWorkspace key={location} path="/employer/dashboard" />;
  if (isSeekerRoute) return <SeekerHome key={location} path={path} />;
  if (path === '/' && (loading || user))
    return (
      <p role="status" className="p-6 text-center text-slate-500">
        Opening your account…
      </p>
    );
  if (
    user &&
    (path.startsWith('/employer/') || path === '/onboarding/employer') &&
    user.role !== 'employer'
  )
    return <EmployerWorkspace key={location} path={path} />;
  if (
    path === '/employer/dashboard' ||
    path.startsWith('/employer/applicants') ||
    path === '/employer/jobs' ||
    path.startsWith('/employer/jobs/')
  )
    return <EmployerWorkspace key={location} path={path} />;
  return path === '/' ? <LandingPage /> : <AccountPage key={location} path={path} />;
}

function LandingPage() {
  const { user, signOut } = useAuth();
  const [preview, setPreview] = useState<PreviewState>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [login, setLogin] = useState<PendingAction | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [appliedSearch, setAppliedSearch] = useState({ keyword: '', location: '' });
  const [category, setCategory] = useState('All opportunities');

  const completeAction = (action: PendingAction) => {
    if (action.kind === 'save') {
      setSavedIds((previous) => {
        const next = new Set(previous);
        if (next.has(action.job.id)) next.delete(action.job.id);
        else next.add(action.job.id);
        return next;
      });
      setFeedback('');
    } else if (action.kind === 'apply') setFeedback(APPLY_PREVIEW_MESSAGE);
    else if (action.kind === 'match') {
      if (selectedJob) setFeedback(MATCH_PREVIEW_MESSAGE);
      else setNotice(MATCH_PREVIEW_MESSAGE);
    } else if (action.kind === 'saved-jobs') setShowSaved(true);
    else navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
  };
  const requestAction = (action: PendingAction) => {
    if (!user) {
      setAuthMode('login');
      setLogin(action);
    } else if (user.profileCompletion < 100) navigate('/onboarding');
    else completeAction(action);
  };
  const showPreview = (kind: PreviewKind) => {
    if (kind === 'login' || kind === 'job-seeker' || kind === 'get-started') {
      setPreview(null);
      requestAction({ kind: 'signin' });
      setAuthMode(kind === 'login' ? 'login' : 'register');
    } else setPreview({ kind });
  };
  const finishSignIn = (result: AuthResult) => {
    setLogin(null);
    navigate(result.redirect);
  };
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
      return;
    }
    setSavedIds(new Set());
    setShowSaved(false);
    setFeedback('');
    setNotice('You’ve signed out. Your account and profile are saved securely.');
  };
  const searchJobs = (term = keyword) => {
    setAppliedSearch({
      keyword: term.trim().toLowerCase(),
      location: location.trim().toLowerCase(),
    });
    setCategory('All opportunities');
    setShowSaved(false);
    document.getElementById('jobs')?.scrollIntoView();
  };
  const resetFilters = () => {
    setKeyword('');
    setLocation('');
    setAppliedSearch({ keyword: '', location: '' });
    setCategory('All opportunities');
    setShowSaved(false);
  };
  const filteredJobs = JOBS.filter((job) => {
    const searchable = [job.title, job.company, job.category, ...job.skills]
      .join(' ')
      .toLowerCase();
    const jobLocation = (job.city + ' ' + job.province).toLowerCase();
    return (
      appliedSearch.keyword.split(/\s+/).every((word) => searchable.includes(word)) &&
      jobLocation.includes(appliedSearch.location) &&
      (category === 'All opportunities' || job.category === category) &&
      (!showSaved || savedIds.has(job.id))
    );
  });

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div id="home" />
      <Header onAction={showPreview} onSignOut={handleSignOut} />
      <main id="main-content">
        <Hero onMatch={() => requestAction({ kind: 'match' })} />
        <JobSearch
          keyword={keyword}
          location={location}
          onKeyword={setKeyword}
          onLocation={setLocation}
          onSearch={() => searchJobs()}
          onPopular={(term) => {
            setKeyword(term);
            searchJobs(term);
          }}
        />
        <FeaturedJobs
          jobs={filteredJobs}
          category={category}
          onCategory={setCategory}
          onReset={resetFilters}
          onView={(job) => {
            setFeedback('');
            setSelectedJob(job);
          }}
          isFiltered={Boolean(
            appliedSearch.keyword || appliedSearch.location || category !== 'All opportunities',
          )}
          savedIds={savedIds}
          showSaved={showSaved}
          onToggleSaved={() =>
            showSaved ? setShowSaved(false) : requestAction({ kind: 'saved-jobs' })
          }
          onMatch={() => requestAction({ kind: 'match' })}
        />
        <MatchingSection />
        <MatchScoreSection />
        <ImpactSection />
        <EmployerSection onAction={showPreview} />
        <FinalCTA onAction={showPreview} />
      </main>
      <Footer onAction={showPreview} />
      {notice && (
        <div className="session-notice">
          <p role="status">{notice}</p>
          <button
            className="icon-button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={18} />
          </button>
        </div>
      )}
      <PreviewDialog preview={preview} onClose={() => setPreview(null)} onAction={showPreview} />
      <JobDetailsModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={(job) => requestAction({ kind: 'apply', job })}
        onSave={(job) => requestAction({ kind: 'save', job })}
        onMatch={() => requestAction({ kind: 'match' })}
        isSaved={selectedJob ? savedIds.has(selectedJob.id) : false}
        feedback={feedback}
      />
      <LoginModal
        initialMode={authMode}
        isOpen={login !== null}
        onClose={() => setLogin(null)}
        onSuccess={finishSignIn}
        reason={login?.kind === 'saved-jobs' ? 'save' : (login?.kind ?? 'signin')}
      />
    </>
  );
}
