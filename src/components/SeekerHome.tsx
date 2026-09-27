import { useEffect } from 'react';
import { useAuth } from '@/auth/useAuth';
import { navigate } from '@/auth/navigation';
import { SeekerShell } from '@/components/seeker/SeekerShell';
import { SeekerDashboard } from '@/components/seeker/SeekerDashboard';
import { JobsPage } from '@/components/seeker/JobsPage';
import { JobDetailPage } from '@/components/seeker/JobDetailPage';
import { RecommendedJobsPage } from '@/components/seeker/RecommendedJobsPage';
import { ApplicationsPage } from '@/components/seeker/ApplicationsPage';
import { DevelopmentPages } from '@/components/seeker/DevelopmentPages';
import { PeoplePage } from '@/components/seeker/PeoplePage';
import { MessagingPage } from '@/components/seeker/MessagingPage';
import { NotificationsPage } from '@/components/seeker/NotificationsPage';
import { ProfilePage } from '@/components/seeker/ProfilePage';
import { ResumePage } from '@/components/seeker/ResumePage';
import { SettingsPage } from '@/components/seeker/SettingsPage';

export function SeekerHome({ path }: { path: string }) {
  const { user, loading, sessionError } = useAuth();
  const allowed = user?.role === 'job_seeker';

  useEffect(() => {
    if (!loading && !sessionError && !user) {
      navigate('/login', { replace: true });
    } else if (allowed && (!user.roleSelected || user.profileCompletion < 100)) {
      navigate(!user.roleSelected ? '/onboarding/select-role' : '/onboarding/job-seeker', {
        replace: true,
      });
    }
  }, [user, loading, sessionError, allowed]);

  // Dynamic Document Titles
  useEffect(() => {
    let title = 'MIMAROPA Works';
    if (path === '/' || path === '/dashboard') title = 'Home | MIMAROPA Works';
    else if (path === '/jobs') title = 'Find Jobs | MIMAROPA Works';
    else if (path === '/jobs/recommended') title = 'Recommended Jobs | MIMAROPA Works';
    else if (path.startsWith('/jobs/')) title = 'Job Details | MIMAROPA Works';
    else if (path.startsWith('/applications')) title = 'My Applications | MIMAROPA Works';
    else if (path.startsWith('/career')) title = 'Career Development | MIMAROPA Works';
    else if (path.startsWith('/people')) title = 'People & Organizations | MIMAROPA Works';
    else if (path.startsWith('/messages')) title = 'Messages | MIMAROPA Works';
    else if (path === '/notifications') title = 'Notifications | MIMAROPA Works';
    else if (path === '/profile/resume') title = 'Manage Resume | MIMAROPA Works';
    else if (path === '/profile') title = 'My Profile | MIMAROPA Works';
    else if (path === '/settings') title = 'Account Settings | MIMAROPA Works';
    document.title = title;
  }, [path]);

  if (loading) {
    return (
      <div className="seeker-app flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#176b61] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Opening your account…</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="seeker-app flex items-center justify-center min-h-screen p-4">
        <div className="sw-card text-center max-w-md p-6">
          <p role="alert" className="text-sm text-rose-700 font-semibold mb-3">
            {sessionError}
          </p>
          <a href="/login" className="sw-btn sw-btn-primary sw-btn-sm">
            Log In Again
          </a>
        </div>
      </div>
    );
  }

  if (!allowed && user) {
    return (
      <div className="seeker-app flex items-center justify-center min-h-screen p-4">
        <div className="sw-card text-center max-w-md p-6 space-y-3">
          <h1 className="text-lg font-bold text-slate-900">Access Restricted</h1>
          <p className="text-xs text-slate-600">
            This area is dedicated to Job Seekers. If you are an employer or administrator, please
            switch to your designated workspace.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(user.role === 'employer' ? '/employer/dashboard' : '/admin/verifications')
            }
            className="sw-btn sw-btn-primary sw-btn-sm"
          >
            Go to Your Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!user || !user.roleSelected || user.profileCompletion < 100) {
    return (
      <div className="seeker-app flex items-center justify-center min-h-screen p-4">
        <p role="status" className="text-sm font-medium text-slate-600">
          {user ? 'Opening your profile setup…' : 'Opening sign in…'}
        </p>
      </div>
    );
  }

  // Render Child View
  let content = <SeekerDashboard />;
  if (path === '/jobs') {
    content = <JobsPage />;
  } else if (path === '/jobs/recommended') {
    content = <RecommendedJobsPage />;
  } else if (path.startsWith('/jobs/')) {
    content = <JobDetailPage id={path.split('/')[2]} />;
  } else if (path === '/applications' || path.startsWith('/applications/')) {
    content = <ApplicationsPage path={path} />;
  } else if (path === '/people' || path.startsWith('/people/')) {
    content = <PeoplePage path={path} />;
  } else if (path === '/messages' || path.startsWith('/messages/')) {
    content = <MessagingPage />;
  } else if (path === '/notifications') {
    content = <NotificationsPage />;
  } else if (path === '/career' || path.startsWith('/career/')) {
    content = <DevelopmentPages path={path} />;
  } else if (path === '/profile/resume') {
    content = <ResumePage />;
  } else if (path === '/profile') {
    content = <ProfilePage />;
  } else if (path === '/settings') {
    content = <SettingsPage />;
  }

  return <SeekerShell path={path}>{content}</SeekerShell>;
}
