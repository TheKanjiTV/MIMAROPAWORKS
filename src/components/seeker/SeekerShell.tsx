import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  Briefcase,
  Bell,
  MessageSquare,
  Search,
  User,
  LogOut,
  ChevronDown,
  CheckCircle2,
  FileText,
  Compass,
  Settings,
  Users,
  Home as HomeIcon,
  X,
} from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/auth/api';
import { handleNavigation, navigate } from '@/auth/navigation';
import { Brand } from '@/components/Brand';
import type { SeekerNotification } from '@/types/seeker';
import './seeker.css';

interface SeekerShellProps {
  children: ReactNode;
  path: string;
}

export function SeekerShell({ children, path }: SeekerShellProps) {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState(
    () => new URLSearchParams(window.location.search).get('q') ?? '',
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notifications, setNotifications] = useState<SeekerNotification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const notifTriggerRef = useRef<HTMLButtonElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      const [notifRes, convRes] = await Promise.all([
        api<{ notifications: SeekerNotification[]; unread_count: number }>('/notifications').catch(
          () => null,
        ),
        api<{ conversations: { unread_count: number }[] }>('/conversations').catch(() => null),
      ]);
      if (!active) return;
      if (notifRes) {
        setNotifications(notifRes.notifications.slice(0, 5));
        setUnreadNotifs(notifRes.unread_count);
      }
      if (convRes) {
        const totalUnread = convRes.conversations.reduce(
          (sum, conversation) => sum + (conversation.unread_count || 0),
          0,
        );
        setUnreadMessages(totalUnread);
      }
    };
    void fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    const handleUpdate = () => void fetchStatus();
    window.addEventListener('mimawork:updates', handleUpdate);
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      if (customEvent.detail?.message) {
        setToastMessage(customEvent.detail.message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMessage(''), 5000);
      }
    };
    window.addEventListener('mimawork:toast', handleToast);

    return () => {
      active = false;
      clearInterval(interval);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      window.removeEventListener('mimawork:updates', handleUpdate);
      window.removeEventListener('mimawork:toast', handleToast);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (profileOpen) {
        setProfileOpen(false);
        profileTriggerRef.current?.focus();
      }
      if (notifOpen) {
        setNotifOpen(false);
        notifTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('focusin', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('focusin', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileOpen, notifOpen]);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/jobs');
    }
  };

  const markNotificationRead = async (id: string, href: string | null) => {
    const notification = notifications.find((item) => item.id === id);
    try {
      if (!notification?.read_at) {
        await api(`/notifications/${encodeURIComponent(id)}/read`, {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: Date.now() } : n)),
        );
        setUnreadNotifs((prev) => Math.max(0, prev - 1));
        window.dispatchEvent(new Event('mimawork:updates'));
      }
    } catch {
      setToastMessage('Could not mark this notification as read. Please try again.');
    }
    if (href) {
      setNotifOpen(false);
      navigate(href);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Could not sign out. Please try again.');
    }
  };

  const completion = Math.min(100, Math.max(0, user?.profileCompletion ?? 0));

  // Active link helper
  const isHome = path === '/' || path === '/dashboard';
  const isJobs = path === '/jobs' || path === '/jobs/recommended' || path.startsWith('/jobs/');
  const isApps = path === '/applications' || path.startsWith('/applications/');
  const isPeople = path === '/people' || path.startsWith('/people/');
  const isMessages = path === '/messages' || path.startsWith('/messages/');
  const isNotifs = path === '/notifications';

  return (
    <div className="seeker-app">
      <a href="#seeker-content" className="skip-link">
        Skip to content
      </a>
      {/* Sticky Modern Header */}
      <header className="seeker-header">
        <div className="seeker-header-inner">
          <div className="seeker-nav-group">
            <Brand href="/dashboard" />
            <nav aria-label="Main Navigation">
              <ul className="seeker-nav-links">
                <li>
                  <a
                    href="/dashboard"
                    aria-current={isHome ? 'page' : undefined}
                    className={`seeker-nav-link ${isHome ? 'active' : ''}`}
                    onClick={handleNavigation}
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/jobs"
                    aria-current={isJobs ? 'page' : undefined}
                    className={`seeker-nav-link ${isJobs ? 'active' : ''}`}
                    onClick={handleNavigation}
                  >
                    Jobs
                  </a>
                </li>
                <li>
                  <a
                    href="/applications"
                    aria-current={isApps ? 'page' : undefined}
                    className={`seeker-nav-link ${isApps ? 'active' : ''}`}
                    onClick={handleNavigation}
                  >
                    My Applications
                  </a>
                </li>
                <li>
                  <a
                    href="/people"
                    aria-current={isPeople ? 'page' : undefined}
                    className={`seeker-nav-link ${isPeople ? 'active' : ''}`}
                    onClick={handleNavigation}
                  >
                    People
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="seeker-header-right">
            {/* Global Search */}
            <form
              className="seeker-global-search"
              role="search"
              aria-label="Job search"
              onSubmit={handleGlobalSearch}
            >
              <Search size={16} className="seeker-global-search-icon" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search jobs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search jobs, companies, or skills"
              />
            </form>

            {/* Messages Icon */}
            <button
              type="button"
              className={`seeker-icon-btn ${isMessages ? 'active' : ''}`}
              aria-label={`Messages ${unreadMessages ? `(${unreadMessages} unread)` : ''}`}
              onClick={() => navigate('/messages')}
            >
              <MessageSquare size={19} />
              {unreadMessages > 0 && (
                <span className="seeker-badge">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
              )}
            </button>

            {/* Notifications Bell & Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                ref={notifTriggerRef}
                type="button"
                className={`seeker-icon-btn ${notifOpen || isNotifs ? 'active' : ''}`}
                aria-label={`Notifications ${unreadNotifs ? `(${unreadNotifs} unread)` : ''}`}
                aria-expanded={notifOpen}
                aria-controls="seeker-notifications"
                onClick={() => {
                  setProfileOpen(false);
                  setNotifOpen((prev) => !prev);
                }}
              >
                <Bell size={19} />
                {unreadNotifs > 0 && (
                  <span className="seeker-badge">{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
                )}
              </button>

              {notifOpen && (
                <section
                  className="seeker-notif-dropdown"
                  id="seeker-notifications"
                  aria-label="Notifications"
                >
                  <div className="seeker-notif-header">
                    <span className="seeker-notif-title">Notifications</span>
                    {unreadNotifs > 0 && (
                      <span className="sw-badge sw-badge-match">{unreadNotifs} new</span>
                    )}
                  </div>
                  <ul className="seeker-notif-list">
                    {notifications.length === 0 ? (
                      <li className="p-4 text-center text-sm text-gray-500">
                        No notifications right now.
                      </li>
                    ) : (
                      notifications.map((notif) => (
                        <li key={notif.id}>
                          <button
                            type="button"
                            className={`seeker-notif-item ${!notif.read_at ? 'unread' : ''}`}
                            onClick={() => void markNotificationRead(notif.id, notif.href)}
                          >
                            <div className="seeker-notif-item-icon">
                              <Bell size={16} />
                            </div>
                            <div className="seeker-notif-content">
                              <h4>{notif.title}</h4>
                              <p>{notif.body}</p>
                              <span className="seeker-notif-time">
                                {new Date(Number(notif.created_at)).toLocaleDateString()}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="seeker-notif-footer">
                    <a
                      href="/notifications"
                      onClick={(e) => {
                        handleNavigation(e);
                        if (e.defaultPrevented) setNotifOpen(false);
                      }}
                    >
                      View all notifications →
                    </a>
                  </div>
                </section>
              )}
            </div>

            {/* Profile Menu Trigger & Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                ref={profileTriggerRef}
                type="button"
                className="seeker-profile-trigger"
                onClick={() => {
                  setNotifOpen(false);
                  setProfileOpen((prev) => !prev);
                }}
                aria-label="Account menu"
                aria-controls="seeker-account-menu"
                aria-expanded={profileOpen}
              >
                <div className="seeker-avatar">
                  {user?.picture ? (
                    <img src={user.picture} alt="" />
                  ) : (
                    user?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <span className="seeker-profile-name">{user?.name?.split(' ')[0] || 'User'}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>

              {profileOpen && (
                <div
                  className="seeker-dropdown"
                  id="seeker-account-menu"
                  role="group"
                  aria-label="Account"
                >
                  <div className="seeker-dropdown-header">
                    <div className="seeker-dropdown-name">{user?.name}</div>
                    <div className="seeker-dropdown-email">{user?.email}</div>

                    <div className="seeker-completeness-box">
                      <div className="seeker-completeness-top">
                        <span>Profile completeness</span>
                        <span>{completion}%</span>
                      </div>
                      <div className="seeker-meter-bar">
                        <div
                          className="seeker-meter-fill"
                          style={{ width: `${Math.min(100, completion)}%` }}
                        />
                      </div>
                      {completion < 100 && (
                        <a
                          href="/profile"
                          className="mt-1 inline-block text-xs font-semibold text-teal-800 hover:underline"
                          onClick={(e) => {
                            handleNavigation(e);
                            if (e.defaultPrevented) setProfileOpen(false);
                          }}
                        >
                          Complete profile →
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="seeker-dropdown-link"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/profile');
                    }}
                  >
                    <User size={16} className="text-gray-500" /> View Profile
                  </button>

                  <button
                    type="button"
                    className="seeker-dropdown-link"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/profile?edit=1');
                    }}
                  >
                    <CheckCircle2 size={16} className="text-gray-500" /> Edit Profile
                  </button>

                  <button
                    type="button"
                    className="seeker-dropdown-link"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/profile/resume');
                    }}
                  >
                    <FileText size={16} className="text-gray-500" /> Resume
                  </button>

                  <button
                    type="button"
                    className="seeker-dropdown-link"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/career');
                    }}
                  >
                    <Compass size={16} className="text-gray-500" /> Career Development
                  </button>

                  <button
                    type="button"
                    className="seeker-dropdown-link"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                  >
                    <Settings size={16} className="text-gray-500" /> Account Settings
                  </button>

                  <div className="seeker-dropdown-divider" />

                  <button
                    type="button"
                    className="seeker-dropdown-link text-red-600 hover:text-red-700"
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="seeker-main" id="seeker-content" tabIndex={-1}>
        {children}
      </main>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="sw-toast" role="status">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            type="button"
            className="ml-2 text-gray-400 hover:text-white"
            onClick={() => setToastMessage('')}
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="seeker-mobile-nav" aria-label="Mobile Navigation">
        <a
          href="/dashboard"
          aria-current={isHome ? 'page' : undefined}
          className={`seeker-mobile-link ${isHome ? 'active' : ''}`}
          onClick={handleNavigation}
        >
          <HomeIcon size={20} />
          <span>Home</span>
        </a>
        <a
          href="/jobs"
          aria-current={isJobs ? 'page' : undefined}
          className={`seeker-mobile-link ${isJobs ? 'active' : ''}`}
          onClick={handleNavigation}
        >
          <Briefcase size={20} />
          <span>Jobs</span>
        </a>
        <a
          href="/applications"
          aria-current={isApps ? 'page' : undefined}
          className={`seeker-mobile-link ${isApps ? 'active' : ''}`}
          onClick={handleNavigation}
        >
          <CheckCircle2 size={20} />
          <span>Applications</span>
        </a>
        <a
          href="/people"
          aria-current={isPeople ? 'page' : undefined}
          className={`seeker-mobile-link ${isPeople ? 'active' : ''}`}
          onClick={handleNavigation}
        >
          <Users size={20} />
          <span>People</span>
        </a>
        <a
          href="/messages"
          aria-current={isMessages ? 'page' : undefined}
          className={`seeker-mobile-link ${isMessages ? 'active' : ''}`}
          onClick={handleNavigation}
        >
          <MessageSquare size={20} />
          <span>Messages</span>
        </a>
      </nav>
    </div>
  );
}
