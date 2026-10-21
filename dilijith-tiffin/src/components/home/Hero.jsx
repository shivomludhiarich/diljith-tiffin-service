import { useState } from 'react';
import { BadgeCheck, Leaf, Repeat } from 'lucide-react';
import Button from '../common/Button';
import Logo from '../common/Logo';
import { useAuth } from '../../context/AuthContext';

const TRUST = [
  { icon: Leaf, label: 'Freshly Prepared' },
  { icon: BadgeCheck, label: 'Hygienically Packed' },
  { icon: Repeat, label: 'Meal Carry-Forward' },
];

// Add your own photo at /public/images/hero.jpg. Until then, the logo is shown instead.
function HeroVisual() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-black">
      {failed ? (
        <Logo className="h-full w-full" />
      ) : (
        <img
          src="/images/hero.jpg"
          alt="Authentic North Indian food: dal, sabzi, roti and rice served with a stainless-steel tiffin box"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function Hero() {
  const { isAuthenticated, role } = useAuth();
  const getStartedTo = isAuthenticated
    ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard')
    : '/register';

  return (
    <section className="section">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">
            Authentic North Indian Food, Delivered Fresh.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted leading-relaxed">
            Enjoy authentic North Indian meals with convenient meal plans, free delivery, flexible meal customization, and meal carry-forward.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button to="/plans" variant="primary" className="h-12 font-bold px-8">
              Explore Our Rates
            </Button>
            <Button to={getStartedTo} variant="outline" className="h-12 font-bold px-8">
              Get Started
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}
