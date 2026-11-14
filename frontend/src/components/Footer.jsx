"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import { ROLE_HOME } from "@/lib/connectbhai/shared";
import { BUSINESS_ADDRESS, BUSINESS_AREAS, BUSINESS_HOURS_TEXT, SOCIAL_FACEBOOK, SOCIAL_INSTAGRAM } from "@/lib/contact";

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
              <li>Area served: {BUSINESS_AREAS.slice(0, -1).join(", ")} &amp; {BUSINESS_AREAS[BUSINESS_AREAS.length - 1]}</li>
              <li>www.connectbhai.com</li>
              <li><a href={SOCIAL_FACEBOOK} target="_blank" rel="noopener noreferrer">Facebook</a> · <a href={SOCIAL_INSTAGRAM} target="_blank" rel="noopener noreferrer">Instagram</a></li>
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
