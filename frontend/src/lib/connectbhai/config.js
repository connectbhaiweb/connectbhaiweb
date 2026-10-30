/* Runtime configuration. Safe to import from Server and Client Components.
   Set the NEXT_PUBLIC_* variables (see .env.example) to switch from the in-browser demo back end to Supabase. */
export const CONFIG = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || null,        // e.g. "https://xyzcompany.supabase.co"
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null, // public anon key (RLS protects data)
  SUPPORT_NAME: "Connect Bhai Admin",
  SUPPORT_PHONE: "9479935365",          // shown to customers and partners for call / WhatsApp
  SUPPORT_EMAIL: "support@connectbhai.in",
};
export const SUPPORT = { name: CONFIG.SUPPORT_NAME, phone: CONFIG.SUPPORT_PHONE, email: CONFIG.SUPPORT_EMAIL, role: "admin" };
export const LIVE = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

/* App store links. Leave empty until the apps are published: the buttons then say "coming soon" and no QR is shown. */
export const APP_LINKS = {
  play: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
  apple: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
  qr: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_PLAY_STORE_URL || null, // what the QR code opens
};
