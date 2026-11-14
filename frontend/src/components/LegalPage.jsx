"use client";
import { useEffect } from "react";

/* Static text page (privacy, terms, refund, shipping, account deletion). Clears the legacy <main id="app"> so the
   previous view does not stay on screen, then shows the text in the site's normal header and footer. */
export default function LegalPage({ title, updated, children }) {
  useEffect(() => { const app = document.getElementById("app"); if (app) app.innerHTML = ""; }, []);
  return (
    <section className="sec legal">
      <div className="wrap legal-in">
        <h1>{title}</h1>
        <p className="muted small">{updated}</p>
        {children}
      </div>
    </section>
  );
}
