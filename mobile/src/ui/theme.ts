/* One theme file, taken from the website's CSS (:root in globals.css and the phone rules, read at 360 px). */
export const colors = {
  bg: '#F4F7FD', surface: '#FFFFFF', ink: '#0A1B3D', muted: '#53617F', line: '#DCE4F2', lineStrong: '#C3D0E8',
  blue: '#1450E6', blueDeep: '#0A2A78', blueSoft: '#E8EFFF', sky: '#8DB4FF', heroText: '#C9D8FF', trust: '#0B3A63', trustText: '#E3F0FF', trustIcon: '#4FD6B0',
  ok: '#11804A', okSoft: '#E2F5EA', warn: '#9A5800', warnSoft: '#FFF1DA', bad: '#B42318', badSoft: '#FDE8E6', grey: '#EEF1F7',
  night: '#050B1F', backdrop: 'rgba(5,14,40,0.55)', white: '#FFFFFF',
};
export const radius = { sm: 8, input: 10, md: 12, card: 14, lg: 18, xl: 22, pill: 999 };
/** Page side gutter, and the space between stacked blocks. */
export const space = { gutter: 16, gap: 12, section: 56 };
export const shadow = { card: '0 8px 24px -12px rgba(10,27,61,0.18)', pop: '0 20px 40px -10px rgba(0,0,0,0.4)' };

export const fontFiles = {
  'Sora-600': require('../../assets/fonts/Sora-600.ttf'),
  'Sora-700': require('../../assets/fonts/Sora-700.ttf'),
  'Sora-800': require('../../assets/fonts/Sora-800.ttf'),
  'Manrope-400': require('../../assets/fonts/Manrope-400.ttf'),
  'Manrope-500': require('../../assets/fonts/Manrope-500.ttf'),
  'Manrope-600': require('../../assets/fonts/Manrope-600.ttf'),
  'Manrope-700': require('../../assets/fonts/Manrope-700.ttf'),
  'Manrope-800': require('../../assets/fonts/Manrope-800.ttf'),
  'PlexMono-500': require('../../assets/fonts/PlexMono-500.ttf'),
  'PlexMono-600': require('../../assets/fonts/PlexMono-600.ttf'),
};
export type Family = 'body' | 'display' | 'mono';
export type Weight = 400 | 500 | 600 | 700 | 800;
export function fontFamily(family: Family, weight: Weight) {
  if (family === 'display') return `Sora-${Math.max(600, weight)}`;
  if (family === 'mono') return `PlexMono-${weight >= 600 ? 600 : 500}`;
  return `Manrope-${weight}`;
}
