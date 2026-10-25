import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import useRecoveryMetadata from '../utils/useRecoveryMetadata';
export default function ForgotPassword() {
  useRecoveryMetadata('Forgot password');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try { setMessage((await api.auth.forgotPassword(email)).message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="section"><div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6">
    <h1 className="text-3xl">Forgot password</h1>
    <p className="mt-3">Enter the email you verified at signup to request a password reset link.</p>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block" htmlFor="recovery-email">Email (required)</label>
      <input id="recovery-email" type="email" autoComplete="email" required maxLength={254} className="field" value={email} onChange={e => setEmail(e.target.value)} />
      <button disabled={busy} className="rounded-xl bg-brand p-3 font-bold text-white disabled:opacity-50">{busy ? 'Requesting...' : 'Request reset link'}</button>
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-danger">{error}</p>}
    </form>
    <Link className="mt-3 block underline" to="/login">Back to login</Link>
  </div></section>;
}
