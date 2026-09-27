import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Brand } from '@/components/Brand';
import type { PreviewAction } from '@/types/landing';
import { useAuth } from '@/auth/useAuth';
import { navigate } from '@/auth/navigation';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Find Jobs', href: '#jobs' },
  { label: 'For Employers', href: '#employers' },
  { label: 'About', href: '#about' },
];

export function Header({
  onAction,
  onSignOut,
}: {
  onAction: PreviewAction;
  onSignOut: () => void;
}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('#home');
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const accountPath =
    user?.role === 'admin'
      ? '/admin/verifications'
      : user?.role === 'employer'
        ? '/employer/dashboard'
        : !user?.roleSelected
          ? '/onboarding/select-role'
          : user.profileCompletion < 100
            ? '/onboarding/job-seeker'
            : '/dashboard';
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        menuRef.current?.focus();
      }
    };
    const closeOutside = (event: Event) => {
      if (!headerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(`#${entry.target.id}`);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    NAV_LINKS.forEach(({ href }) => {
      const section = document.querySelector(href);
      if (section) observer.observe(section);
    });
    const activateHomeAtTop = () => {
      if (window.scrollY < 100) setActiveSection('#home');
    };
    window.addEventListener('scroll', activateHomeAtTop, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', activateHomeAtTop);
    };
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className={link.href === activeSection ? 'nav-home' : ''}
              href={link.href}
              aria-current={link.href === activeSection ? 'location' : undefined}
              onClick={() => setActiveSection(link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="signed-in-name" title={user.name}>
                <span aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
                {user.name.split(' ')[0]}
              </span>
              <button className="login-button" onClick={() => navigate(accountPath)}>
                My account
              </button>
              <button className="login-button" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="login-button" onClick={() => onAction('login')}>
                Sign in
              </button>
            </>
          )}
          {!user && (
            <button
              className="button button-primary button-small"
              onClick={() => onAction('get-started')}
            >
              Get started <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <button
          ref={menuRef}
          type="button"
          className="menu-toggle icon-button"
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>
      {isOpen && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.href === activeSection ? 'location' : undefined}
              onClick={() => {
                setActiveSection(link.href);
                setIsOpen(false);
              }}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => {
              setIsOpen(false);
              if (user) onSignOut();
              else onAction('login');
            }}
          >
            {user ? 'Sign out' : 'Sign in'}
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              setIsOpen(false);
              if (user) navigate(accountPath);
              else onAction('get-started');
            }}
          >
            {user ? 'My account' : 'Get started'} <ArrowUpRight size={16} />
          </button>
        </nav>
      )}
    </header>
  );
}
