import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { passwordError } from '../utils/authValidation';
import useRecoveryMetadata from '../utils/useRecoveryMetadata';

export default function ResetPassword() {
  useRecoveryMetadata('Reset password');
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [token, setToken] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''));
  const [reference, setReference] = useState('');
  useEffect(() => { crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(bytes => setReference(Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''))); }, [token]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(!/^[a-f0-9]{64}$/.test(token));
  // Keep the bearer secret only in component memory, not history or storage.
  // Refreshing creates a fresh secret and requires a new admin approval.
  useEffect(() => {
    if (location.search) navigate('/reset-password', { replace: true });
  }, [location.search, navigate]);
  async function submit(e) {
    e.preventDefault();
    if (busy || invalid) return;
    const validation = passwordError(password, confirmation);
    setError(validation);
    if (validation) return;
    setBusy(true);
    try {
      await api.auth.resetPassword({ token, password, confirmPassword: confirmation });
      setPassword(''); setConfirmation(''); setToken(''); setDone(true);
      logout();
      navigate('/reset-password', { replace: true });
    } catch (err) {
      setError(err.data?.code === 'INVALID_RESET_TOKEN' ? 'Recovery is not approved, has expired, or was already used. Ask the administrator to approve your reference.' : err.message);
    } finally { setBusy(false); }
  }
  return <section className="section"><div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm">
    <h1 className="text-3xl">Reset password</h1>
    {done ? <p role="status" className="mt-4 text-leaf">Your password has been updated. Log in with your new password.</p> : invalid ? <div className="mt-4">
      <p role="alert" className="text-danger">This reset link is invalid or has expired. Please request a new link.</p>
      <Link to="/forgot-password" className="mt-3 block font-bold text-brand underline">Request a new reset link</Link>
    </div> : <>
      <p className="mt-3 text-muted">Keep this page open. After verifying your identity, give the administrator this reference. Approval lasts 20 minutes. Refreshing creates a new reference requiring approval. No email or SMS is sent.</p>
      <output aria-label="Recovery reference" className="block break-all p-3 border rounded">{reference}</output>
      <p>After approval, choose your new password below.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><label htmlFor="new-password" className="block text-sm font-bold">New password</label><input id="new-password" type="password" autoComplete="new-password" className="field mt-1" required minLength={6} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div><label htmlFor="confirm-new-password" className="block text-sm font-bold">Confirm new password</label><input id="confirm-new-password" type="password" autoComplete="new-password" className="field mt-1" required minLength={6} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand p-3 font-bold text-white disabled:opacity-50">{busy ? 'Updating password…' : 'Reset Password'}</button>
      </form>
    </>}
    <Link to="/login" className="mt-5 block font-bold text-brand underline">Back to login</Link>
  </div></section>;
}
