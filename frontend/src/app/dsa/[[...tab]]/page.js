import { Suspense } from "react";
import ViewRoute from "@/components/ViewRoute";
import CarePlanPage from "@/components/careplan/CarePlan";

import DsaDashboard from "@/components/portal/DsaDashboard";

/* /dsa and /dsa/<tab>  (replaces the old #dsa and #dsa-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  const t = tab ? decodeURIComponent(tab[0]) : null;
  return <><ViewRoute view="dsa" tab={t} /><Suspense fallback={null}><DsaDashboard tab={t} /></Suspense><CarePlanPage base="dsa" tab={t} /></>;
}
