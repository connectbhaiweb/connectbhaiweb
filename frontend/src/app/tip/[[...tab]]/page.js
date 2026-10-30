import ViewRoute from "@/components/ViewRoute";

/* /tip and /tip/<tab>  (replaces the old #tip and #tip-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  return <ViewRoute view="tip" tab={tab ? decodeURIComponent(tab[0]) : null} />;
}
