import ViewRoute from "@/components/ViewRoute";

/* /admin and /admin/<tab>  (replaces the old #admin and #admin-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  return <ViewRoute view="admin" tab={tab ? decodeURIComponent(tab[0]) : null} />;
}
