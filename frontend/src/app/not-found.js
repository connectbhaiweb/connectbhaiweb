import Link from "next/link";

/* Next.js already adds <meta name="robots" content="noindex"> to every 404, so robots is cleared here (null) to avoid a second,
   conflicting tag from the root layout. A 404 has no canonical: it must not point at the home page. */
export const metadata = {
  title: { absolute: "Page not found | Connect Bhai" },
  description: "This Connect Bhai page does not exist. Go back to the home page to compare broadband plans in Indore.",
  robots: null,
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <section className="sec" aria-labelledby="nf-h">
      <div className="wrap" style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <h1 id="nf-h">Page not found</h1>
        <p className="muted">The page you opened does not exist or has moved.</p>
        <p>
          <Link className="btn btn-primary" href="/">Go to the home page</Link>{" "}
          <Link className="btn btn-ghost" href="/speed">Run a speed test</Link>
        </p>
      </div>
    </section>
  );
}
