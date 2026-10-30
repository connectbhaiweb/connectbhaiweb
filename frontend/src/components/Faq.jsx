"use client";
import { useState } from "react";
import { CONFIG } from "@/lib/connectbhai/config";

/* Answers use only facts the site itself states (partner verification, request flow, Care plan, speed test). */
const CATS = ["All", "Plans", "Booking & payment", "Installation", "Router & speed"];
const ITEMS = [
  ["Plans", "How can I compare plans by pincode?", "Enter your 6-digit pincode or area on the home page. We show only the plans and partners that serve your address, and you can compare up to 3 plans side by side."],
  ["Plans", "Are only verified providers shown?", "Partners (DSAs and BSNL TIP partners) are verified by our admin team before any lead is assigned to them, and plans are reviewed before they go live. Plans marked as sample data are placeholders until verified tariffs are added."],
  ["Router & speed", "Can I run a speed test before choosing?", "Yes. The Wi-Fi speed test is free, takes about 30 seconds and works on your phone or laptop. Log in if you want to save the result or report slow speed to support."],
  ["Booking & payment", "How do I pay the booking amount?", "Requesting a connection is free for customers. When a payment is due, you get a WhatsApp message with the amount and can pay online by UPI, card or net banking. Your payments are also listed under Payments in your dashboard."],
  ["Installation", "How long does installation take?", "After you request a connection, an assigned partner calls you and books a time. Every step (assigned, contacted, booked, installed) is updated in your dashboard, so you always see where it stands. Exact timing depends on your area and the partner."],
  ["Router & speed", "Can I check my router status after installation?", "Yes, with the Connect Bhai Care plan (through GenieACS) you can see if your router is online, check fiber signal, restart it, change your Wi-Fi name or password and run a line speed test from the app."],
];

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
