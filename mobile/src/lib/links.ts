/* Everything that leaves the app opens the right native app or browser. */
import { Linking } from 'react-native';

export const openUrl = (url: string) => Linking.openURL(url).catch(() => {});
export const callPhone = (phone: string) => openUrl('tel:' + (phone.startsWith('+') ? phone : '+91' + phone));
export const whatsApp = (phone?: string, text?: string) =>
  openUrl(`https://wa.me/${phone ? '91' + phone.replace(/\D/g, '').slice(-10) : ''}${text ? '?text=' + encodeURIComponent(text) : ''}`);
export const mail = (address: string) => openUrl('mailto:' + address);
export const openMaps = (query: string) => openUrl('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query));
