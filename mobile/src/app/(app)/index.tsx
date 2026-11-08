import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/* "/" opens the website-style home for guests and customers, the role dashboard for partners and admins */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user && user.role !== 'customer' ? '/dashboard' : '/home'} />;
}
