import { Suspense } from "react";
import ViewRoute from "@/components/ViewRoute";
import TipDashboard from "@/components/portal/TipDashboard";

/* /tip and /tip/<tab>  (replaces the old #tip and #tip-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  const t = tab ? decodeURIComponent(tab[0]) : null;
  return <><ViewRoute view="tip" tab={t} /><Suspense fallback={null}><TipDashboard tab={t} /></Suspense></>;
}
