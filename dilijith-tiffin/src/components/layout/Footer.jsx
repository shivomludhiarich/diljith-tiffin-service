import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import Logo from '../common/Logo';
import { BRAND } from '../../config/brand';

const col = 'space-y-2 text-sm text-muted';
const lnk = 'hover:text-leaf';

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-line bg-bg2">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="h-24 w-24 rounded-2xl" />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Authentic North Indian home-cooked meals, prepared fresh and hygienically packed, delivered right to your doorstep.
          </p>
        </div>

        <nav aria-label="Explore">
          <h3 className="mb-3 text-lg">Explore</h3>
          <ul className={col}>
            <li><Link className={lnk} to="/">Home</Link></li>
            <li><Link className={lnk} to="/#how-it-works">How It Works</Link></li>
            <li><Link className={lnk} to="/#faq">FAQ</Link></li>
            <li><Link className={lnk} to="/login">Login</Link></li>
          </ul>
        </nav>

        <nav aria-label="Menu and pricing">
          <h3 className="mb-3 text-lg">Menu and pricing</h3>
          <ul className={col}>
            <li><Link className={lnk} to="/plans">Rates &amp; Pricing</Link></li>
            <li><Link className={lnk} to="/register">Create an account</Link></li>
          </ul>
        </nav>

        <div>
          <h3 className="mb-3 text-lg">Contact</h3>
          <ul className={col}>
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <a href={`tel:${BRAND.contact.phone.replace(/\s+/g, '')}`} className="hover:text-leaf">{BRAND.contact.phone}</a>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <a href={`mailto:${BRAND.contact.email}`} className="hover:text-leaf">{BRAND.contact.email}</a>
            </li>
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {BRAND.contact.address}
            </li>
          </ul>
          <ul className="mt-4 flex flex-wrap gap-4 text-sm">
            {BRAND.social.map((s) => (
              <li key={s.label}>
                <a className="text-muted hover:text-leaf" href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        &copy; {new Date().getFullYear()} {BRAND.name}. Authentic North Indian Food Delivered Fresh.
      </div>
    </footer>
  );
}
