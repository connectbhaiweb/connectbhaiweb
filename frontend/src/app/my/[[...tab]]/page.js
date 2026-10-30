import ViewRoute from "@/components/ViewRoute";

/* /my and /my/<tab>  (replaces the old #my and #my-<tab> hash URLs) */
export default async function Page({ params }) {
  const { tab } = await params;
  return <ViewRoute view="my" tab={tab ? decodeURIComponent(tab[0]) : null} />;
}
