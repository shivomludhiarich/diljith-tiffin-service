import { Link } from 'react-router-dom';

const base =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50';

// Login / Sign Up style: off-white pill, thin dark outline, flat offset shadow that "presses in" on hover/click.
const pop =
  'border border-ink bg-white px-8 font-retro text-base font-bold tracking-wide text-ink transition-[transform,box-shadow] duration-150 ' +
  'hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-1 active:translate-y-1 active:shadow-none';

const variants = {
  primary: 'transition-colors bg-accent text-ink hover:bg-gold',
  accent: 'transition-colors bg-accent text-ink hover:bg-gold',
  outline: 'transition-colors border border-ink/25 text-ink hover:border-ink',
  ghost: 'transition-colors text-muted hover:text-ink',
  danger: 'transition-colors bg-danger text-white hover:opacity-90',
  popGreen: `${pop} shadow-popGreen hover:shadow-popGreenSm`,   // Login / My Dashboard
  popOrange: `${pop} shadow-popOrange hover:shadow-popOrangeSm`, // Sign Up
  popRed: `${pop} shadow-popRed hover:shadow-popRedSm`,         // Logout
};

/** Router <Link> when `to` is given, external <a> when `href` is given, otherwise a <button>. */
export default function Button({ to, href, variant = 'primary', className = '', children, ...props }) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...props}>{children}</a>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}
