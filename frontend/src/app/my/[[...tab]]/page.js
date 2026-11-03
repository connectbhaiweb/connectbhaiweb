import { Suspense } from "react";
import ViewRoute from "@/components/ViewRoute";
import CustomerDashboard from "@/components/customer/CustomerDashboard";

/* /my and /my/<tab>  (replaces the old #my and #my-<tab> hash URLs). Home/Bookings is a React page; other tabs are the app's views. */
export default async function Page({ params }) {
  const { tab } = await params;
  const t = tab ? decodeURIComponent(tab[0]) : null;
  return (
    <>
      <ViewRoute view="my" tab={t} />
      <Suspense fallback={null}><CustomerDashboard tab={t} /></Suspense>
    </>
  );
}
