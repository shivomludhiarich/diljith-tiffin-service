import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, User, Phone, Check, AlertCircle, Loader2,
  ArrowRight, MapPin, Home,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRY_CODES, validatePhone } from '../utils/phone';
import Logo from '../components/common/Logo';
import { BRAND } from '../config/brand';

// ---------------------------------------------------------------------------
// Indian States list
// ---------------------------------------------------------------------------
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// ---------------------------------------------------------------------------
// Field config helper
// ---------------------------------------------------------------------------
const inputCls =
  'w-full rounded-xl border border-line bg-white py-2.5 pl-3 pr-3 text-sm font-semibold text-ink placeholder-muted/60 shadow-sm transition-focus focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, role, registerWithCredentials } = useAuth();
  const { notify } = useToast();

  // Personal info
  const [name, setName]             = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone]           = useState('');

  // Address
  const [houseOrFlat, setHouseOrFlat] = useState('');
  const [street, setStreet]           = useState('');
  const [area, setArea]               = useState('');
  const [city, setCity]               = useState('');
  const [addrState, setAddrState]     = useState('');
  const [postalCode, setPostalCode]   = useState('');

  // Security
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [isSuccess, setIsSuccess]   = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'admin' ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  // Password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    if (pwd.length < 6) return { score: 1, label: 'Too short (min 6 chars)', color: 'text-danger bg-danger' };
    let score = 1;
    if (pwd.length >= 8) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd) || /[A-Z]/.test(pwd)) score++;
    if (score <= 2) return { score: 2, label: 'Fair', color: 'text-amber bg-accent' };
    if (score === 3) return { score: 3, label: 'Good', color: 'text-leaf bg-brand' };
    return { score: 4, label: 'Strong', color: 'text-leaf bg-leaf' };
  };
  const strength = getPasswordStrength(password);

  // Clear field error helpers
  const clearErr = (field) => setErrors((prev) => ({ ...prev, [field]: '' }));

  // Frontend validation
  const validate = () => {
    const e = {};

    if (!name.trim()) e.name = 'Please enter your full name.';

    if (!phone.trim()) {
      e.phone = 'Please enter your phone number.';
    } else {
      const check = validatePhone(phone, countryCode);
      if (!check.valid) e.phone = check.message;
    }

    // Address
    if (!houseOrFlat.trim()) e.houseOrFlat = 'House / flat number is required.';
    if (!street.trim())      e.street      = 'Street / locality is required.';
    if (!city.trim())        e.city        = 'City is required.';
    if (!addrState)          e.addrState   = 'Please select your state.';
    if (!postalCode.trim())  e.postalCode  = 'PIN code is required.';
    else if (countryCode === '+91' && !/^\d{6}$/.test(postalCode.trim()))
      e.postalCode = 'Indian PIN codes must be exactly 6 digits.';

    if (!password)           e.password = 'Please choose a password.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';

    if (!confirmPassword)    e.confirmPassword = 'Please confirm your password.';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const res = await registerWithCredentials({
        name: name.trim(),
        phone: phone.trim(),
        countryCode,
        password,
        confirmPassword,
        address: {
          houseOrFlat: houseOrFlat.trim(),
          street:      street.trim(),
          area:        area.trim(),
          city:        city.trim(),
          state:       addrState,
          postalCode:  postalCode.trim(),
          country:     'India',
        },
      });

      if (!res.ok) {
        // Map server address errors back to form fields
        if (res.data?.addressErrors) {
          const mapped = {};
          Object.entries(res.data.addressErrors).forEach(([k, v]) => { mapped[k] = v; });
          setErrors((prev) => ({ ...prev, ...mapped }));
        } else if (res.data?.field && res.data?.message) {
          setErrors((prev) => ({ ...prev, [res.data.field]: res.data.message }));
        } else {
          setGeneralError(res.error || 'Registration failed. Please try again.');
        }
        notify(res.error || 'Registration failed.', 'error');
        return;
      }

      setIsSuccess(true);
      notify('Account created successfully! Welcome to Dilijith Tiffin Service.', 'success');
      setTimeout(() => navigate('/user/dashboard', { replace: true }), 1200);
    } catch (err) {
      setGeneralError(err.message || 'An unexpected error occurred.');
      notify(err.message || 'Registration failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col justify-center bg-bg py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <Link to="/" className="flex flex-col items-center justify-center gap-2">
          <Logo className="h-16 w-16 rounded-2xl shadow-sm" />
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Create an account
          </h1>
        </Link>
        <p className="mt-2 text-center text-sm text-muted">
          Join {BRAND.name} for authentic North Indian home-cooked meals
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl px-4 sm:px-0">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">

          {/* Success banner */}
          {isSuccess ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Check className="h-8 w-8" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold text-ink">Account Created!</h2>
              <p className="mt-2 text-sm text-muted">Setting up your profile and taking you to your dashboard...</p>
              <div className="mt-6 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            </div>
          ) : (
            <>
              {generalError && (
                <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                  <div className="flex-1 font-semibold">{generalError}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-6">

                {/* ── Section: Personal info ── */}
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                    <User className="h-4 w-4 text-brand" aria-hidden="true" />
                    Personal information
                  </h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">

                    {/* Full Name */}
                    <div className="sm:col-span-2">
                      <label htmlFor="register-name" className="block text-sm font-bold text-ink">
                        Full name <span className="text-danger">*</span>
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="register-name" name="name" type="text"
                          autoComplete="name" required
                          placeholder="e.g. Priya Sharma"
                          value={name}
                          onChange={(e) => { setName(e.target.value); clearErr('name'); }}
                          className={inputCls + ' pr-10'}
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <User className="h-4 w-4 text-muted" aria-hidden="true" />
                        </div>
                      </div>
                      <FieldError message={errors.name} />
                    </div>

                    {/* Phone Number */}
                    <div className="sm:col-span-2">
                      <label htmlFor="register-phone" className="block text-sm font-bold text-ink">
                        Phone number <span className="text-danger">*</span>
                      </label>
                      <div className="mt-1.5 flex rounded-xl border border-line bg-white shadow-sm transition-focus focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                        <select
                          id="register-country-code" aria-label="Country Code"
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="rounded-l-xl border-r border-line bg-surface/60 px-3 py-2.5 text-sm font-semibold text-ink focus:outline-none"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>{c.code} ({c.country})</option>
                          ))}
                        </select>
                        <div className="relative flex-1">
                          <input
                            id="register-phone" name="phone" type="tel"
                            autoComplete="tel" required
                            placeholder="98765 43210"
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); clearErr('phone'); setGeneralError(''); }}
                            className="w-full rounded-r-xl border-0 py-2.5 pl-3 pr-10 text-sm font-semibold text-ink placeholder-muted/60 focus:outline-none"
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                      {errors.phone ? (
                        <FieldError message={errors.phone} />
                      ) : (
                        <p className="mt-1 text-xs text-muted">We will use this to coordinate meal deliveries.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section: Delivery Address ── */}
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                    <MapPin className="h-4 w-4 text-brand" aria-hidden="true" />
                    Delivery address <span className="text-danger">*</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">Your meals will be delivered to this address every day.</p>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">

                    {/* House / Flat */}
                    <div className="sm:col-span-2">
                      <label htmlFor="reg-house" className="block text-sm font-bold text-ink">
                        House / flat no. &amp; building <span className="text-danger">*</span>
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="reg-house" name="houseOrFlat" type="text"
                          autoComplete="address-line1"
                          placeholder="e.g. Flat 4B, Sunrise Apartments"
                          value={houseOrFlat}
                          onChange={(e) => { setHouseOrFlat(e.target.value); clearErr('houseOrFlat'); }}
                          className={inputCls}
                        />
                      </div>
                      <FieldError message={errors.houseOrFlat} />
                    </div>

                    {/* Street */}
                    <div className="sm:col-span-2">
                      <label htmlFor="reg-street" className="block text-sm font-bold text-ink">
                        Street / locality <span className="text-danger">*</span>
                      </label>
                      <input
                        id="reg-street" name="street" type="text"
                        autoComplete="address-line2"
                        placeholder="e.g. 12th Cross Road, Indiranagar"
                        value={street}
                        onChange={(e) => { setStreet(e.target.value); clearErr('street'); }}
                        className={inputCls + ' mt-1.5'}
                      />
                      <FieldError message={errors.street} />
                    </div>

                    {/* Area (optional) */}
                    <div>
                      <label htmlFor="reg-area" className="block text-sm font-bold text-ink">
                        Area <span className="text-muted text-xs font-normal">(optional)</span>
                      </label>
                      <input
                        id="reg-area" name="area" type="text"
                        placeholder="e.g. Sector 17"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className={inputCls + ' mt-1.5'}
                      />
                    </div>

                    {/* City */}
                    <div>
                      <label htmlFor="reg-city" className="block text-sm font-bold text-ink">
                        City <span className="text-danger">*</span>
                      </label>
                      <input
                        id="reg-city" name="city" type="text"
                        autoComplete="address-level2"
                        placeholder="e.g. Bengaluru"
                        value={city}
                        onChange={(e) => { setCity(e.target.value); clearErr('city'); }}
                        className={inputCls + ' mt-1.5'}
                      />
                      <FieldError message={errors.city} />
                    </div>

                    {/* State */}
                    <div>
                      <label htmlFor="reg-state" className="block text-sm font-bold text-ink">
                        State <span className="text-danger">*</span>
                      </label>
                      <select
                        id="reg-state" name="state"
                        value={addrState}
                        onChange={(e) => { setAddrState(e.target.value); clearErr('addrState'); }}
                        className={inputCls + ' mt-1.5'}
                      >
                        <option value="">Select state…</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <FieldError message={errors.addrState} />
                    </div>

                    {/* PIN Code */}
                    <div>
                      <label htmlFor="reg-pin" className="block text-sm font-bold text-ink">
                        PIN code <span className="text-danger">*</span>
                      </label>
                      <input
                        id="reg-pin" name="postalCode" type="text"
                        inputMode="numeric" maxLength={6}
                        autoComplete="postal-code"
                        placeholder="e.g. 560038"
                        value={postalCode}
                        onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '')); clearErr('postalCode'); }}
                        className={inputCls + ' mt-1.5'}
                      />
                      <FieldError message={errors.postalCode} />
                    </div>
                  </div>
                </div>

                {/* ── Section: Password ── */}
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                    <Home className="h-4 w-4 text-brand" aria-hidden="true" />
                    Account security
                  </h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">

                    {/* Password */}
                    <div>
                      <label htmlFor="register-password" className="block text-sm font-bold text-ink">
                        Password <span className="text-danger">*</span>
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="register-password" name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password" required
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            clearErr('password');
                            if (errors.confirmPassword && confirmPassword && e.target.value === confirmPassword)
                              clearErr('confirmPassword');
                          }}
                          className={inputCls + ' pr-10'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink focus:outline-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>

                      {/* Strength bar */}
                      {password && (
                        <div className="mt-2">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface">
                            <div className={`h-full transition-all duration-300 ${
                              strength.score === 1 ? 'w-1/4 bg-danger'
                              : strength.score === 2 ? 'w-2/4 bg-accent'
                              : strength.score === 3 ? 'w-3/4 bg-brand'
                              : 'w-full bg-leaf'
                            }`} />
                          </div>
                          <span className={`mt-1 block text-right text-xs font-semibold ${strength.color.split(' ')[0]}`}>
                            Strength: {strength.label}
                          </span>
                        </div>
                      )}
                      <FieldError message={errors.password} />
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="register-confirm-password" className="block text-sm font-bold text-ink">
                        Confirm password <span className="text-danger">*</span>
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="register-confirm-password" name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password" required
                          placeholder="Repeat your password"
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); clearErr('confirmPassword'); }}
                          className={inputCls + ' pr-10'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((p) => !p)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink focus:outline-none"
                          aria-label={showConfirmPassword ? 'Hide' : 'Show'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                      <FieldError message={errors.confirmPassword} />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-ink bg-accent py-3 text-base font-bold text-ink shadow-popOrange transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-popOrangeSm active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Creating account...</>
                  ) : (
                    <><span>Create Account</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-sm">
                <span className="text-muted">Already have an account? </span>
                <Link to="/login" className="font-bold text-leaf hover:underline focus:outline-none focus:underline">
                  Log in instead
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
