export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function passwordError(password, confirmation) {
  if (typeof password !== 'string' || password.length < 6) return 'Password must be at least 6 characters.';
  if (new TextEncoder().encode(password).length > 72) return 'Password must be no more than 72 bytes.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}
