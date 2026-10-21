// WhatsApp deep links. Automatically cleans numbers, ensures international country code (default 91 for India),
// and formats official wa.me chat URLs.
export const PLACEHOLDER_NUMBER = '910000000000';

export const cleanNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  // If user entered 10 digits without country code, prefix India's +91
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
};

export const isConfiguredNumber = (value) => {
  const n = cleanNumber(value);
  return /^\d{10,15}$/.test(n) && n !== PLACEHOLDER_NUMBER;
};

export const buildWhatsappUrl = (number, message = '') => {
  if (!isConfiguredNumber(number)) return null;
  const clean = cleanNumber(number);
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${clean}${textParam}`;
};

export const mealEnquiryMessage = ({ mealOption, price }) =>
  `Hello! I would like to enquire about the ${mealOption} (₹${typeof price === 'number' ? price.toLocaleString('en-IN') : price}) at Dilijith Tiffin Service.`;

export const buildMealWhatsappUrl = (mealOption, price, number) => {
  const envNum = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WHATSAPP_NUMBER;
  const target = number || envNum || '918699476361';
  const message = mealEnquiryMessage({ mealOption, price });
  return buildWhatsappUrl(target, message);
};

export const renewalMessage = ({ name, plan }) =>
  `Hello, I would like to renew my Dilijith Tiffin Service subscription. My name is ${name}, and my current plan is ${plan}.`;
