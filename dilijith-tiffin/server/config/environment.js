export function validateEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || /replace|placeholder|example|changeme|your.secret/i.test(secret)) throw new Error('Configure a strong production JWT_SECRET.');
  if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI || '')) throw new Error('Configure MONGODB_URI.');
  let origin;
  try { origin = new URL(process.env.ALLOWED_ORIGIN); } catch { throw new Error('Configure ALLOWED_ORIGIN.'); }
  if (origin.protocol !== 'https:' || origin.origin !== process.env.ALLOWED_ORIGIN) throw new Error('ALLOWED_ORIGIN must be an exact HTTPS origin.');
}
