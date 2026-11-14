"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import { ROLE_HOME } from "@/lib/connectbhai/shared";
import { BUSINESS_ADDRESS, BUSINESS_AREAS, BUSINESS_HOURS_TEXT, SOCIAL_FACEBOOK, SOCIAL_INSTAGRAM } from "@/lib/contact";

/* Round brand icons (Facebook blue "f", Instagram gradient camera), drawn inline so no image file is needed. */
const FbIcon = () => (
  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#3B5998" /><path fill="#fff" d="M26.5 38V25.7h4.1l.6-4.8h-4.7v-3c0-1.4.4-2.3 2.4-2.3h2.5V11.3c-.4-.1-1.9-.2-3.6-.2-3.6 0-6.1 2.2-6.1 6.3v3.5h-4.1v4.8h4.1V38h4.8z" /></svg>
);
const IgIcon = () => (
  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
    <defs><linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FEDA75" /><stop offset=".3" stopColor="#FA7E1E" /><stop offset=".55" stopColor="#D62976" /><stop offset=".8" stopColor="#962FBF" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs>
    <circle cx="24" cy="24" r="24" fill="url(#ig-g)" />
    <rect x="12.5" y="12.5" width="23" height="23" rx="6.5" fill="none" stroke="#fff" strokeWidth="2.6" />
    <circle cx="24" cy="24" r="5.6" fill="none" stroke="#fff" strokeWidth="2.6" />
    <circle cx="31" cy="17" r="1.6" fill="#fff" />
  </svg>
);

export default function Footer() {
  const { user } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Link className="brand" href="/?site=1" aria-label="Connect Bhai home">
              <Logo height={40} />
            </Link>
            <p style={{ marginTop: 8 }}>
              Compare BSNL, Jio, Airtel and local ISP fiber, SIM, TV &amp; OTT plans by PIN code in Indore. Book connection &amp; get Connect Bhai Care.
            </p>
          </div>
          <div>
            <h4>Customers</h4>
            <ul>
              <li><button className="linkbtn" data-go="home" data-scroll="search" type="button">Search by PIN code</button></li>
              <li><button className="linkbtn" data-go="speed" type="button">Wi-Fi speed test</button></li>
              <li><button className="linkbtn footer-care" data-go="care" type="button">Care plan</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="faq" type="button">FAQ</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="get-app" type="button">Get the app</button></li>
              {user && <li><button className="linkbtn" data-go={ROLE_HOME[user.role] || "my"} type="button">My dashboard</button></li>}
              <li><button className="linkbtn" data-go="home" data-scroll="partners" type="button">Become a DSA or TIP</button></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li>{BUSINESS_ADDRESS}</li>
              <li>{BUSINESS_HOURS_TEXT}</li>
              <li>{`Area served: ${BUSINESS_AREAS.slice(0, -1).join(", ")} & ${BUSINESS_AREAS[BUSINESS_AREAS.length - 1]}`}</li>
              <li>www.connectbhai.com</li>
              <li>
                <b style={{ display: "block", marginBottom: 8 }}>Follow Us On</b>
                <span style={{ display: "flex", gap: 14 }}>
                  <a href={SOCIAL_FACEBOOK} target="_blank" rel="noopener noreferrer" aria-label="Connect Bhai on Facebook"><FbIcon /></a>
                  <a href={SOCIAL_INSTAGRAM} target="_blank" rel="noopener noreferrer" aria-label="Connect Bhai on Instagram"><IgIcon /></a>
                </span>
              </li>
              <li className="small">
                Plans shown here are sample data until verified tariffs are added. Connect Bhai is an independent marketplace and does not claim live integration with any ISP.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
