/* City choice: live first, then by size, as on the website. */
import type { City } from '../../lib/api/types';
import type { Option } from '../../ui/forms';

export const citySort = (a: City, b: City) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || a.tier - b.tier || a.name.localeCompare(b.name);

export function cityOptions(cities: City[], all?: boolean): Option[] {
  const sorted = cities.slice().sort(citySort);
  return [
    ...sorted.filter((c) => c.status === 'live').map((c) => ({ value: c.id, label: c.name, group: 'Live now' })),
    ...sorted.filter((c) => c.status !== 'live').map((c) => ({ value: c.id, label: all ? c.name : `${c.name} · soon`, group: all ? 'Coming soon' : 'Launching soon' })),
  ];
}
