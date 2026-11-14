"use client";
import { useState } from "react";
import { CONFIG } from "@/lib/connectbhai/config";
import { CATS, ITEMS } from "@/lib/faqData";

export default function Faq() {
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(0);
  const list = ITEMS.filter(([c]) => cat === "All" || c === cat);
  const phone = CONFIG.SUPPORT_PHONE;
  return (
    <section className="sec faqsec" id="faq" aria-labelledby="faq-h">
      <div className="wrap faq-grid">
        <div className="faq-side">
          <span className="faq-pill">FAQ</span>
          <h2 id="faq-h">Got questions? We have answers, Bhai.</h2>
          <p className="muted">Everything you need to know about comparing, booking and installing your connection.</p>
          <div className="help">
            <div className="help-top">
              <span className="help-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 14v-2a8 8 0 0116 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg></span>
              <div><b>Still need help?</b><p>Our experts reply in minutes, in Hindi and English.</p></div>
            </div>
            <div className="help-btns">
              <a className="btn btn-primary" href={`tel:+91${phone}`}>Call us</a>
              <a className="btn btn-ghost" href={`https://wa.me/91${phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          </div>
        </div>
        <div className="faq-main">
          <div className="faq-cats" role="tablist" aria-label="FAQ topics">
            {CATS.map(c => (<button key={c} type="button" role="tab" aria-selected={cat === c} className="faq-cat" onClick={() => { setCat(c); setOpen(0); }}>{c}</button>))}
          </div>
          <div className="faq-list">
            {list.map(([, q, a], i) => (
              <div key={q} className={"faq-item" + (open === i ? " open" : "")}>
                <h3><button type="button" aria-expanded={open === i} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{q}</span><i aria-hidden="true">{open === i ? "×" : "+"}</i>
                </button></h3>
                <div className="faq-a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={open !== i}><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
