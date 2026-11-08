import { Platform } from 'react-native';

/* The Android emulator reaches the Mac at 10.0.2.2, the iOS simulator at localhost.
   A real phone needs the Mac's Wi-Fi address: set EXPO_PUBLIC_API_URL (see .env.example).
   Production builds must use an https URL. */
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallback).replace(/\/$/, '');

export const SUPPORT = { name: 'Connect Bhai Support', phone: '9479935365', email: 'support@connectbhai.in' };
