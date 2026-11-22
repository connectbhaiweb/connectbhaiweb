import { useSyncExternalStore } from 'react';
import type { Plan } from './catalog';

/* Plans picked for comparison (max 3), shared between the Plans tab and the compare screen. */
let picked: Plan[] = [];
let pin = '';
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const compare = {
  toggle(p: Plan) {
    picked = picked.some((x) => x.id === p.id) ? picked.filter((x) => x.id !== p.id) : picked.length < 3 ? [...picked, p] : picked;
    emit();
  },
  clear() { picked = []; emit(); },
  setPin(v: string) { pin = v; },
  get pin() { return pin; },
  get list() { return picked; },
};
export const useCompare = () => useSyncExternalStore(subscribe, () => picked);
