/* Form rules shared by every screen. Port of the helpers at the top of the website's ui.js. */
import { useCallback, useState } from 'react';

import { isPhone } from './api/base';

/** Accept +91 / 91 / 0 prefixes, spaces and dashes; Indian mobiles only. */
export const normPhone = (v: string) => {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
export const phoneError = (v: string) => {
  const d = normPhone(v);
  if (!d) return 'Enter your 10-digit mobile number.';
  if (d.length !== 10) return 'Enter a 10-digit mobile number without the country code.';
  if (!isPhone(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9. Only +91 numbers are supported.';
  return '';
};
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export const errMsg = (e: unknown) => {
  const m = (e as Error)?.message || '';
  if (!m) return 'Something went wrong. Please try again.';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(m)) return 'Cannot reach the server. Check your internet connection and try again.';
  if (/rate limit|too many|after \d+ seconds|security purposes/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
  if (/token has expired|otp.*(expired|invalid)|expired.*otp/i.test(m)) return 'That OTP is incorrect or has expired. Request a new one.';
  return m;
};

/** Values and inline errors of one form. Typing in a field clears that field's error, as on the website. */
export function useForm<V extends Record<string, any>>(initial: V) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof V, string>>>({});
  const set = useCallback(<K extends keyof V>(name: K, value: V[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);
  /** Shows the errors; true when there is none. */
  const check = useCallback((next: Partial<Record<keyof V, string>>) => {
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }, []);
  const reset = useCallback(() => {
    setValues(initial);
    setErrors({});
    // the first values are fixed for the life of the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { values, errors, set, check, reset, setValues };
}
