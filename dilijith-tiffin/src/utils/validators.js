export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isPhone = (v) => /^(\+91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));
export const minLength = (v, n) => v.length >= n;
