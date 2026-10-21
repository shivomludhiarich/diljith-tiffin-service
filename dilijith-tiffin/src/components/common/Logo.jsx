import { BRAND } from '../../config/brand';

// The supplied logo, untouched. It has its own black background, so it sits as a black tile on the white page.
export default function Logo({ className = 'h-16 w-16 rounded-2xl' }) {
  return (
    <img src={BRAND.logo} alt={`${BRAND.name} logo`} className={`${className} object-contain`} width="640" height="640" />
  );
}
