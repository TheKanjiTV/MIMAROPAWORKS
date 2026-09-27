import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import type { SeekerNotification } from '@/types/seeker';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<SeekerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await api<{ notifications: SeekerNotification[]; unread_count: number }>(
          '/notifications',
        );
        setNotifications(res.notifications);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load notifications.');
      } finally {
        setLoading(false);
      }
    };
    void loadNotifications();
  }, []);

  const markAsRead = async (notif: SeekerNotification) => {
    setError('');
    if (!notif.read_at) {
      try {
        await api(`/notifications/${encodeURIComponent(notif.id)}/read`, {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read_at: Date.now() } : n)),
        );
        window.dispatchEvent(new Event('mimawork:updates'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not mark this notification as read.');
        return;
      }
    }
    if (notif.href) {
      navigate(notif.href);
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setError('');
    const unread = notifications.filter((n) => !n.read_at);
    const results = await Promise.allSettled(
      unread.map((n) => api(`/notifications/${encodeURIComponent(n.id)}/read`, {})),
    );
    const readIds = new Set(
      unread.filter((_, index) => results[index].status === 'fulfilled').map((n) => n.id),
    );
    setNotifications((prev) =>
      prev.map((n) => (readIds.has(n.id) ? { ...n, read_at: Date.now() } : n)),
    );
    window.dispatchEvent(new Event('mimawork:updates'));
    if (readIds.size < unread.length) {
      setError(
        'Some notifications could not be marked as read. They remain unread; please try again.',
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: 'All notifications marked as read.' },
        }),
      );
    }
    setMarkingAll(false);
  };

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read_at : true));

  const getIcon = (type: string | null) => {
    switch (type) {
      case 'message':
        return <MessageSquare size={17} className="text-[#176b61]" />;
      case 'application':
        return <CheckCircle2 size={17} className="text-emerald-600" />;
      case 'match':
        return <Sparkles size={17} className="text-amber-500" />;
      default:
        return <Bell size={17} className="text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {/* Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Notifications</h1>
          <p className="text-sm text-slate-600">
            Stay informed about your applications, messages, and new job matches in MIMAROPA.
          </p>
        </div>

        {notifications.some((n) => !n.read_at) && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={markingAll}
            className="sw-btn sw-btn-secondary sw-btn-sm shrink-0"
          >
            {markingAll ? 'Marking as read…' : 'Mark all as read'}
          </button>
        )}
      </section>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filter === 'all' ? 'bg-[#176b61] text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          aria-pressed={filter === 'unread'}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filter === 'unread' ? 'bg-[#176b61] text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Unread ({notifications.filter((n) => !n.read_at).length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="sw-skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="sw-card text-center py-14 px-6">
          <Bell size={40} className="mx-auto text-slate-300 mb-2" />
          <h2 className="text-base font-bold text-slate-800 mb-1">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            When employers update your applications or send messages, you will receive alerts here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((notif) => (
            <article
              key={notif.id}
              className={`sw-card p-4 flex flex-wrap items-start justify-between gap-4 ${
                !notif.read_at ? 'bg-teal-50/25 border-teal-200' : 'bg-white'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-0.5">{notif.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{notif.body}</p>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(Number(notif.created_at)).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-1">
                {!notif.read_at && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#176b61]" title="Unread" />
                )}
                {(notif.href || !notif.read_at) && (
                  <button
                    type="button"
                    onClick={() => void markAsRead(notif)}
                    disabled={markingAll}
                    className="sw-btn sw-btn-secondary sw-btn-sm"
                    aria-label={notif.href ? `View ${notif.title}` : `Mark ${notif.title} as read`}
                  >
                    {notif.href ? 'View' : 'Mark as read'} <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
