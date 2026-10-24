/**
 * Standard phone utilities for Diljit Tiffin Service.
 * Default country: India (+91)
 */

export const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: 'India (+91)', digits: 10 },
  { code: '+1', country: 'US', label: 'USA / Canada (+1)', digits: 10 },
  { code: '+44', country: 'GB', label: 'UK (+44)', digits: 10 },
  { code: '+971', country: 'AE', label: 'UAE (+971)', digits: 9 },
  { code: '+65', country: 'SG', label: 'Singapore (+65)', digits: 8 },
];

/**
 * Strips all formatting characters (spaces, dashes, parentheses)
 */
export function sanitizeDigits(str = '') {
  return String(str).replace(/\D/g, '');
}

/**
 * Normalizes phone number into standard international format (+<countryCode><digits>)
 * If rawInput has +91 or starts with 0 or has country code prefix, handles it cleanly.
 */
export function normalizePhone(rawInput = '', defaultCountryCode = '+91') {
  if (!rawInput) return '';
  let str = String(rawInput).trim();

  // If already starts with '+', keep the '+'
  let hasPlus = str.startsWith('+');
  let clean = sanitizeDigits(str);

  if (hasPlus) {
    // Check if starts with a known country code
    for (const c of COUNTRY_CODES) {
      const codeDigits = sanitizeDigits(c.code);
      if (clean.startsWith(codeDigits)) {
        return `+${clean}`;
      }
    }
    return `+${clean}`;
  }

  // Handle leading 0 (common in India e.g. 09876543210)
  if (defaultCountryCode === '+91' && clean.length === 11 && clean.startsWith('0')) {
    clean = clean.slice(1);
  }

  // If input matches India's 10-digit format
  const prefix = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
  const codeDigits = sanitizeDigits(prefix);

  if (clean.startsWith(codeDigits)) {
    return `+${clean}`;
  }

  return `${prefix}${clean}`;
}

/**
 * Validates normalized phone number
 */
export function validatePhone(phone, countryCode = '+91') {
  const normalized = normalizePhone(phone, countryCode);
  const digits = sanitizeDigits(normalized);

  if (countryCode === '+91') {
    // India: country code 91 + 10 digits (typically 6, 7, 8, 9, or demo 9)
    const indianDigits = digits.slice(2);
    if (indianDigits.length !== 10) {
      return { valid: false, message: 'Phone number must be exactly 10 digits.' };
    }
    if (!/^[6-9]\d{9}$/.test(indianDigits)) {
      return { valid: false, message: 'Please enter a valid 10-digit Indian mobile number.' };
    }
    return { valid: true, normalized };
  }

  // Generic fallback validation: 8 to 15 digits
  if (digits.length < 8 || digits.length > 15) {
    return { valid: false, message: 'Please enter a valid phone number.' };
  }

  return { valid: true, normalized };
}
