import { handleNavigation } from '@/auth/navigation';

export function SeekerNav({ path }: { path: string }) {
  const links = [
    ['/dashboard', 'Home'],
    ['/jobs', 'Jobs'],
    ['/applications', 'My Applications'],
    ['/career', 'Career Development'],
    ['/profile', 'Profile'],
    ['/profile/resume', 'Resume'],
  ];
  return (
    <nav className="seeker-nav" aria-label="Job Seeker navigation">
      {links.map(([url, label]) => (
        <a
          key={url}
          href={url}
          onClick={handleNavigation}
          aria-current={
            path === url ||
            (url === '/jobs' && path.startsWith('/jobs/')) ||
            (url === '/applications' && path.startsWith('/applications/')) ||
            (url === '/career' && path.startsWith('/career/')) ||
            (url === '/profile' && path.startsWith('/onboarding/job-seeker'))
              ? 'page'
              : undefined
          }
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
