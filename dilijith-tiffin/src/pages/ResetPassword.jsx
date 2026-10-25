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
  const [token, setToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [invalid] = useState(!/^[a-f0-9]{64}$/.test(token));
  // Keep the bearer secret only in component memory, not history or storage.
  // After refreshing, reopen the link from your email.
  useEffect(() => {
    if (location.search || location.hash) navigate('/reset-password', { replace: true });
  }, [location.search, location.hash, navigate]);
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
      await logout();
      navigate('/reset-password', { replace: true });
    } catch (err) {
      setError(err.data?.code === 'INVALID_RESET_TOKEN' ? 'This reset link has expired or was already used. Request a new link.' : err.message);
    } finally { setBusy(false); }
  }
  return <section className="section"><div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm">
    <h1 className="text-3xl">Reset password</h1>
    {done ? <p role="status" className="mt-4 text-leaf">Your password has been updated. Log in with your new password.</p> : invalid ? <div className="mt-4">
      <p role="alert" className="text-danger">This reset link is invalid or has expired. Please request a new link.</p>
      <Link to="/forgot-password" className="mt-3 block font-bold text-brand underline">Request a new reset link</Link>
    </div> : <>
      <p className="mt-3 text-muted">Choose a new password. Your emailed link expires after 20 minutes and works once.</p>
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
