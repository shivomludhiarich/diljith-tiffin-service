import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Phone, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRY_CODES, validatePhone, sanitizeDigits } from '../utils/phone';
import Logo from '../components/common/Logo';
import { BRAND } from '../config/brand';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role, loginWithCredentials, loading: authLoading } = useAuth();
  const { notify } = useToast();

  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Destination after login (if redirected from a protected route)
  const from = location.state?.from;

  // If already authenticated, redirect to appropriate dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const target = from || (role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, role, navigate, from]);

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    // Allow digits and formatting
    setPhone(val);
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
    if (generalError) setGeneralError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
    if (generalError) setGeneralError('');
  };

  const validate = () => {
    const nextErrors = {};
    const phoneCheck = validatePhone(phone, countryCode);
    if (!phone.trim()) {
      nextErrors.phone = 'Please enter your phone number.';
    } else if (!phoneCheck.valid) {
      nextErrors.phone = phoneCheck.message;
    }

    if (!password) {
      nextErrors.password = 'Please enter your password.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const res = await loginWithCredentials({
        phone: phone.trim(),
        password,
        countryCode,
      });

      if (!res.ok) {
        setGeneralError(res.error || 'Invalid phone number or password.');
        notify(res.error || 'Invalid phone number or password.', 'error');
        return;
      }

      notify('Logged in successfully!', 'success');
      const target = from || (res.user?.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
      navigate(target, { replace: true });
    } catch (err) {
      setGeneralError(err.message || 'An unexpected error occurred. Please try again.');
      notify(err.message || 'Login failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col justify-center bg-bg py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex flex-col items-center justify-center gap-2">
          <Logo className="h-16 w-16 rounded-2xl shadow-sm" />
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Welcome back
          </h1>
        </Link>
        <p className="mt-2 text-center text-sm text-muted">
          Log in with your phone number to manage your tiffin subscription
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
          {generalError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              <div className="flex-1 font-semibold">{generalError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Phone Number Field with Country Code */}
            <div>
              <label htmlFor="login-phone" className="block text-sm font-bold text-ink">
                Phone number
              </label>
              <div className="mt-1.5 flex rounded-xl border border-line bg-white shadow-sm transition-focus focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <select
                  id="login-country-code"
                  aria-label="Country Code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="rounded-l-xl border-r border-line bg-surface/60 px-3 py-2.5 text-sm font-semibold text-ink focus:outline-none"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.country})
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <input
                    id="login-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    placeholder="98765 43210"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full rounded-r-xl border-0 py-2.5 pl-3 pr-10 text-sm font-semibold text-ink placeholder-muted/60 focus:outline-none"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                  </div>
                </div>
              </div>
              {errors.phone && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-sm font-bold text-ink">
                  Password
                </label>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  className="w-full rounded-xl border border-line bg-white py-2.5 pl-3 pr-10 text-sm font-semibold text-ink placeholder-muted/60 shadow-sm transition-focus focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Link to="/forgot-password" className="block text-right text-sm font-bold text-brand hover:underline">Forgot password?</Link>
            <button
              type="submit"
              disabled={submitting || authLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-ink bg-brand py-3 text-base font-bold text-white shadow-popGreen transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-popGreenSm active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting || authLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Logging in...
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Sign up prompt */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted">Don&apos;t have an account yet? </span>
            <Link
              to="/register"
              className="font-bold text-leaf hover:underline focus:outline-none focus:underline"
            >
              Sign up for meals
            </Link>
          </div>


        </div>
      </div>
    </div>
  );
}
