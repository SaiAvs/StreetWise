import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, LogOut, MapPin, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchNotifications, markNotificationsRead } from '@/lib/data';
import { timeAgo, type Notification } from '@/lib/types';

const NAV: Record<string, { to: string; label: string }[]> = {
  citizen: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/report', label: 'Report Issue' },
    { to: '/complaints', label: 'My Complaints' },
    { to: '/map', label: 'Community Map' },
    { to: '/profile', label: 'Profile' },
  ],
  authority: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/queue', label: 'Work Queue' },
    { to: '/map', label: 'Map View' },
    { to: '/profile', label: 'Profile' },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/admin/complaints', label: 'Complaints' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/people', label: 'People' },
    { to: '/map', label: 'Map View' },
    { to: '/profile', label: 'Profile' },
  ],
};

export default function Layout() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const links = NAV[role ?? 'citizen'] ?? [];

  useEffect(() => {
    if (!user) return;
    fetchNotifications().then(setNotifications).catch(() => {});
  }, [user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  async function handleMarkRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    await markNotificationsRead(unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="rounded-lg bg-brand-600 p-1.5 text-white"><MapPin className="h-5 w-5" /></span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              Street<span className="text-brand-600">Wise</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {unread > 0 && (
                      <button onClick={handleMarkRead} className="text-xs font-medium text-brand-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-slate-50 px-4 py-3 ${n.is_read ? '' : 'bg-brand-50/60'}`}
                        >
                          <p className="text-sm font-medium text-slate-800">{n.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline">
              {profile?.full_name || user?.email} · {role}
            </span>
            <button
              onClick={handleSignOut}
              className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 sm:block"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="mt-2 block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
