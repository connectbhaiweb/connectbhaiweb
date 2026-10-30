import ViewRoute from "@/components/ViewRoute";
import AppDownload from "@/components/AppDownload";
import Faq from "@/components/Faq";

/* The plans/search/results view paints itself into <main id="app">; these two sections are server-rendered React. */
export default function HomePage() {
  return (
    <>
      <ViewRoute view="home" />
      <AppDownload />
      <Faq />
    </>
  );
}
