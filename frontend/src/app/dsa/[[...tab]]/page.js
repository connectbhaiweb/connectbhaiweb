import ViewRoute from "@/components/ViewRoute";

/* /dsa and /dsa/<tab>  (replaces the old #dsa and #dsa-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  return <ViewRoute view="dsa" tab={tab ? decodeURIComponent(tab[0]) : null} />;
}
