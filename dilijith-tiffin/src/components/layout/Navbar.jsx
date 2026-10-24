import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../common/Logo';
import Button from '../common/Button';
import { BRAND, WHATSAPP_URL } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  { label: 'Home', to: '/', end: true },
  { label: 'How It Works', to: '/#how-it-works', hash: true },
  { label: 'Meal Plans', to: '/#rates', hash: true },
  { label: 'FAQ', to: '/#faq', hash: true },
  { label: 'Contact', href: WHATSAPP_URL },
];

const linkCls = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'text-leaf' : 'text-muted hover:text-ink'}`;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => { logout(); navigate('/', { replace: true }); };
  const portal = role === 'admin' ? '/admin/dashboard' : '/user/dashboard';

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  const renderLink = (l, mobile) => {
    if (l.href) {
      return (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-md px-3 py-2 text-sm font-semibold text-muted hover:text-ink ${mobile ? 'block' : ''}`}
        >
          {l.label}
        </a>
      );
    }
    return l.hash ? (
      <Link key={l.label} to={l.to} className={`rounded-md px-3 py-2 text-sm font-semibold text-muted hover:text-ink ${mobile ? 'block' : ''}`}>
        {l.label}
      </Link>
    ) : (
      <NavLink key={l.label} to={l.to} end={l.end} className={(s) => `${linkCls(s)} ${mobile ? 'block' : ''}`}>
        {l.label}
      </NavLink>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg">
      <div className="container-x flex h-20 items-center justify-between gap-4">
        <Link to="/" aria-label={`${BRAND.name} home`} className="shrink-0">
          <Logo className="h-16 w-16 rounded-2xl" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => renderLink(l, false))}
        </nav>

        <div className="hidden items-center gap-5 pr-1 lg:flex">
          {isAuthenticated ? (
            <>
              <Button to={portal} variant="popGreen">My Dashboard</Button>
              <Button variant="popRed" onClick={signOut}>Logout</Button>
            </>
          ) : (
            <>
              <Button to="/login" variant="popGreen">Login</Button>
              <Button to="/register" variant="popOrange">Sign Up</Button>
            </>
          )}
        </div>

        <button
          className="rounded-md p-2 text-ink lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-bg2 lg:hidden">
          <div className="container-x flex flex-col gap-1 py-4">
            {LINKS.map((l) => renderLink(l, true))}
            <div className="mt-3 flex flex-col gap-4 pr-1">
              {isAuthenticated ? (
                <>
                  <Button to={portal} variant="popGreen">My Dashboard</Button>
                  <Button variant="popRed" onClick={signOut}>Logout</Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="popGreen">Login</Button>
                  <Button to="/register" variant="popOrange">Sign Up</Button>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
