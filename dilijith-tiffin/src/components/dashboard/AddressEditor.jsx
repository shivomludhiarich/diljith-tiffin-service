import { useState } from 'react';
import { MapPin, Edit2, Check, X, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// ---------------------------------------------------------------------------
// Indian States list (same as Register.jsx)
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

const inputCls =
  'w-full rounded-xl border border-line bg-white py-2.5 px-3 text-sm font-semibold text-ink placeholder-muted/60 shadow-sm transition-focus focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {message}
    </p>
  );
}

function formatAddress(addr) {
  if (!addr) return null;
  return [addr.houseOrFlat, addr.street, addr.area, addr.city, addr.state, addr.postalCode]
    .filter(Boolean).join(', ');
}

export default function AddressEditor({ address: initialAddress }) {
  const { updateUser } = useAuth();
  const { notify } = useToast();

  const [editing, setEditing]     = useState(false);
  const [saving,  setSaving]      = useState(false);
  const [errors,  setErrors]      = useState({});
  const [address, setAddress]     = useState(initialAddress);

  // Form state
  const [houseOrFlat, setHouseOrFlat] = useState(initialAddress?.houseOrFlat ?? '');
  const [street,      setStreet]      = useState(initialAddress?.street      ?? '');
  const [area,        setArea]        = useState(initialAddress?.area        ?? '');
  const [city,        setCity]        = useState(initialAddress?.city        ?? '');
  const [addrState,   setAddrState]   = useState(initialAddress?.state       ?? '');
  const [postalCode,  setPostalCode]  = useState(initialAddress?.postalCode  ?? '');

  const clearErr = (field) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const startEditing = () => {
    // Reset form to latest saved address
    setHouseOrFlat(address?.houseOrFlat ?? '');
    setStreet     (address?.street      ?? '');
    setArea       (address?.area        ?? '');
    setCity       (address?.city        ?? '');
    setAddrState  (address?.state       ?? '');
    setPostalCode (address?.postalCode  ?? '');
    setErrors({});
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); setErrors({}); };

  const validate = () => {
    const e = {};
    if (!houseOrFlat.trim()) e.houseOrFlat = 'House / flat number is required.';
    if (!street.trim())      e.street      = 'Street / locality is required.';
    if (!city.trim())        e.city        = 'City is required.';
    if (!addrState)          e.addrState   = 'Please select your state.';
    if (!postalCode.trim())  e.postalCode  = 'PIN code is required.';
    else if (!/^\d{6}$/.test(postalCode.trim())) e.postalCode = 'Indian PIN codes must be exactly 6 digits.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const newAddress = {
        houseOrFlat: houseOrFlat.trim(),
        street:      street.trim(),
        area:        area.trim(),
        city:        city.trim(),
        state:       addrState,
        postalCode:  postalCode.trim(),
        country:     'India',
      };
      const res = await api.user.updateAddress(newAddress);
      if (res?.ok) {
        setAddress(res.address);
        updateUser({ address: res.address });
        setEditing(false);
        notify('Delivery address updated successfully.', 'success');
      } else {
        notify(res?.message || 'Failed to save address.', 'error');
      }
    } catch (err) {
      // Map server address errors to fields if available
      if (err.data?.addressErrors) {
        setErrors(err.data.addressErrors);
      }
      notify(err.message || 'Failed to save address.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addrText = formatAddress(address);

  return (
    <section aria-labelledby="address-section-title" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="address-section-title" className="text-2xl">Delivery address</h2>
        {!editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-brand hover:text-brand transition"
          >
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            {address ? 'Edit' : 'Add address'}
          </button>
        )}
      </div>

      {/* View mode */}
      {!editing && (
        <div className={`rounded-xl border p-5 ${address ? 'border-line bg-white' : 'border-amber/40 bg-accent/5'}`}>
          {addrText ? (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">{address.houseOrFlat}</p>
                <p className="text-sm text-muted">{[address.street, address.area].filter(Boolean).join(', ')}</p>
                <p className="text-sm text-muted">{[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}</p>
                {address.country && <p className="text-xs text-muted mt-0.5">{address.country}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">No delivery address on file</p>
                <p className="text-sm text-muted mt-0.5">
                  Please add your address so we can deliver your meals. Your meals may not be dispatched until an address is saved.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="rounded-xl border border-brand/30 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">

            {/* House / Flat */}
            <div className="sm:col-span-2">
              <label htmlFor="addr-house" className="block text-sm font-bold text-ink">
                House / flat no. &amp; building <span className="text-danger">*</span>
              </label>
              <input
                id="addr-house" name="houseOrFlat" type="text"
                placeholder="e.g. Flat 4B, Sunrise Apartments"
                value={houseOrFlat}
                onChange={(e) => { setHouseOrFlat(e.target.value); clearErr('houseOrFlat'); }}
                className={inputCls + ' mt-1.5'}
              />
              <FieldError message={errors.houseOrFlat} />
            </div>

            {/* Street */}
            <div className="sm:col-span-2">
              <label htmlFor="addr-street" className="block text-sm font-bold text-ink">
                Street / locality <span className="text-danger">*</span>
              </label>
              <input
                id="addr-street" name="street" type="text"
                placeholder="e.g. 12th Cross Road, Indiranagar"
                value={street}
                onChange={(e) => { setStreet(e.target.value); clearErr('street'); }}
                className={inputCls + ' mt-1.5'}
              />
              <FieldError message={errors.street} />
            </div>

            {/* Area (optional) */}
            <div>
              <label htmlFor="addr-area" className="block text-sm font-bold text-ink">
                Area <span className="text-muted text-xs font-normal">(optional)</span>
              </label>
              <input
                id="addr-area" name="area" type="text"
                placeholder="e.g. Sector 17"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className={inputCls + ' mt-1.5'}
              />
            </div>

            {/* City */}
            <div>
              <label htmlFor="addr-city" className="block text-sm font-bold text-ink">
                City <span className="text-danger">*</span>
              </label>
              <input
                id="addr-city" name="city" type="text"
                placeholder="e.g. Bengaluru"
                value={city}
                onChange={(e) => { setCity(e.target.value); clearErr('city'); }}
                className={inputCls + ' mt-1.5'}
              />
              <FieldError message={errors.city} />
            </div>

            {/* State */}
            <div>
              <label htmlFor="addr-state" className="block text-sm font-bold text-ink">
                State <span className="text-danger">*</span>
              </label>
              <select
                id="addr-state" name="state"
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
              <label htmlFor="addr-pin" className="block text-sm font-bold text-ink">
                PIN code <span className="text-danger">*</span>
              </label>
              <input
                id="addr-pin" name="postalCode" type="text"
                inputMode="numeric" maxLength={6}
                placeholder="e.g. 560038"
                value={postalCode}
                onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '')); clearErr('postalCode'); }}
                className={inputCls + ' mt-1.5'}
              />
              <FieldError message={errors.postalCode} />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl border border-ink bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-popGreenSm transition-[transform,box-shadow] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-60"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Saving…</>
              ) : (
                <><Check className="h-4 w-4" aria-hidden="true" />Save address</>
              )}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink transition"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
