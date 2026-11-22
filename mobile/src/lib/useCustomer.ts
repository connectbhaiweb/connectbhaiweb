import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { loadCustomer, type CustomerData } from '@/lib/customer';
import { useSession } from '@/lib/session';

/** Loads the customer's data each time the screen is focused (shared by the Bookings, Care plan and Payments tabs). */
export function useCustomer() {
  const { user } = useSession();
  const [data, setData] = useState<CustomerData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (user?.role !== 'customer') return;
    setBusy(true); setError('');
    try { setData(await loadCustomer()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { user, data, busy, error, load };
}
