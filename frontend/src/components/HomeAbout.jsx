import Link from "next/link";
import { BUSINESS_AREAS } from "@/lib/contact";
import "./home-about.css";

/* Server-rendered text for the bottom of the home page: crawlers and AI tools read it without running JavaScript.
   Every sentence repeats a fact the site already states (FAQ, shipping policy, Care plan). Hindi lines live in lib/i18n/hi-extra.js. */
const STEPS = [
  ["Enter your PIN code", "Type your 6-digit PIN code or area. We show only the plans and partners that serve your address."],
  ["Compare plans", "Compare BSNL, Jio, Airtel and local ISP fiber, SIM, TV and OTT plans side by side."],
  ["Request a connection", "Send a request. A partner calls you, confirms the plan and books the installation."],
  ["Get installed and cared for", "An installer visits your address. Your Care plan lets you check and restart your router from your phone."],
];

export default function HomeAbout() {
  return (
    <section className="sec aboutsec" id="about-connect-bhai" aria-labelledby="about-h">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="about-h">About Connect Bhai</h2>
          <p>Connect Bhai is a broadband marketplace for Madhya Pradesh, live in Indore. Compare. Choose. Connect. Care.</p>
        </div>
        <ol className="about-steps">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="about-step">
              <span className="about-num" aria-hidden="true">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <div className="about-areas">
          <h3>Areas we serve</h3>
          <ul>{BUSINESS_AREAS.map(a => <li key={a}>{a}</li>)}</ul>
          <ul className="about-links">
            <li><Link href="/speed">Run the free Wi-Fi speed test</Link></li>
            <li><Link href="/care">How the Care plan fixes router and Wi-Fi problems</Link></li>
          </ul>
        </div>
      </div>
    </section>
  );
}
