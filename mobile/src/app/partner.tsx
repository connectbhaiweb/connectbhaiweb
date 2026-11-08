import { Screen } from '@/components/ui';
import { PartnerForm } from '@/components/partner-form';

/* DSA / TIP application as its own screen (the same form is also on the home page, like the website). */
export default function Partner() {
  return <Screen tabBar={false}><PartnerForm /></Screen>;
}
