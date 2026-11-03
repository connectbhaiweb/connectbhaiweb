import { Suspense } from "react";
import ViewRoute from "@/components/ViewRoute";
import AdminDashboard from "@/components/portal/AdminDashboard";

/* /admin and /admin/<tab>  (replaces the old #admin and #admin-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  const t = tab ? decodeURIComponent(tab[0]) : null;
  return <><ViewRoute view="admin" tab={t} /><Suspense fallback={null}><AdminDashboard tab={t} /></Suspense></>;
}
