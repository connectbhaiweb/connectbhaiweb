/* The API address comes only from the build environment (see .env.example). It must be written out in full
   as process.env.EXPO_PUBLIC_API_URL so Expo can put the value into the bundle. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
