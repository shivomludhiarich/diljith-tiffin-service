import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react';
import Logo from '../components/common/Logo';
import { BRAND } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CalendarCheck },
];

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    notify('Logged out.', 'info');
    navigate('/', { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-2">
        <Logo className="h-12 w-12 rounded-xl" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-lg font-bold">Dilijith Tiffin</p>
          <p className="text-xs font-semibold text-muted">Admin portal</p>
        </div>
      </div>

      <nav aria-label="Admin" className="mt-8 flex-1 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors ${isActive ? 'bg-ink text-white' : 'text-muted hover:bg-bg2 hover:text-ink'}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line pt-4">
        <p className="truncate px-3 pb-2 text-xs text-muted">{user?.name ?? 'Dilijith Admin'}</p>
        <button onClick={signOut} className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-danger transition-colors hover:bg-bg2">
          <LogOut className="h-5 w-5" aria-hidden="true" />Logout
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white p-4 lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <span className="font-display text-lg font-bold">{BRAND.name.replace(' Service', '')} Admin</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open admin menu" aria-expanded={open} aria-controls="admin-mobile-nav" className="rounded-md p-2">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex bg-black/50 lg:hidden" onMouseDown={() => setOpen(false)}>
          <div id="admin-mobile-nav" role="dialog" aria-modal="true" aria-label="Admin menu" onMouseDown={(e) => e.stopPropagation()}
            className="relative h-full w-72 max-w-[85%] bg-white p-4">
            <button onClick={() => setOpen(false)} aria-label="Close admin menu" className="absolute right-3 top-3 rounded-md p-1 text-muted hover:text-ink">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
