import { useColorScheme } from 'react-native';

/* Same colour tokens as the website (frontend/src/app/globals.css), light and dark. */
const light = {
  bg: '#F4F7FD', surface: '#FFFFFF', ink: '#0A1B3D', muted: '#53617F', line: '#DCE4F2', lineStrong: '#C3D0E8',
  blue: '#1450E6', blueInk: '#FFFFFF', blueDeep: '#0A2A78', blueSoft: '#E8EFFF', sky: '#8DB4FF',
  ok: '#11804A', okSoft: '#E2F5EA', warn: '#9A5800', warnSoft: '#FFF1DA', bad: '#B42318', badSoft: '#FDE8E6',
};
const dark: typeof light = {
  bg: '#060E20', surface: '#0D1830', ink: '#E6EDFF', muted: '#9AA9C9', line: '#1C2B4D', lineStrong: '#2A3D66',
  blue: '#4F86FF', blueInk: '#03102E', blueDeep: '#071A4A', blueSoft: '#12244A', sky: '#8DB4FF',
  ok: '#43C985', okSoft: '#0F2E20', warn: '#F2B356', warnSoft: '#33240A', bad: '#FF8A7E', badSoft: '#3A1512',
};
export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);
export const radius = 14;
