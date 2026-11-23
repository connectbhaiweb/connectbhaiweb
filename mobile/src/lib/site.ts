import { api } from './api';

/** Public business details (same as frontend/src/lib/contact.js). */
export const SITE = 'https://connectbhai.in';
export const PHONE_E164 = '+919479935365';
export const PHONE_WA = '919479935365';
export const PHONE_TEXT = '+91 94799 35365';
export const WA_URL = `https://wa.me/${PHONE_WA}?text=${encodeURIComponent('Hi Connect Bhai, I need help choosing a broadband plan.')}`;
export const ADDRESS = '215-A, Mahalaxmi Nagar, Indore (M.P.) 452010';
export const HOURS = 'Open daily, 08:00 to 18:00';
export const AREAS = 'Area served: Indore, Depalpur, Mhow & Sanwer';
export const FACEBOOK = 'https://www.facebook.com/connectbhai';
export const INSTAGRAM = 'https://www.instagram.com/connectbhai';
export const LEGAL: [string, string][] = [['Privacy Policy', '/privacy'], ['Account Deletion', '/delete-account'], ['Terms of Service', '/terms'], ['Refund Policy', '/refund'], ['Shipping Policy', '/shipping']];

export type City = { id: number; name: string; status: 'live' | 'soon' | string };
export const loadCities = () => api<City[]>('GET', '/cities', undefined, { anon: true });
export const joinWaitlist = (f: { city_id: number; phone: string; name: string }) => api('POST', '/waitlist', f, { anon: true });
