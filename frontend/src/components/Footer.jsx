"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import { ROLE_HOME } from "@/lib/connectbhai/shared";

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
              Compare. Choose. Connect. Care. A broadband marketplace for Madhya Pradesh, live in Indore, connecting customers with BSNL TIPs, Direct Selling Agents and local internet providers.
            </p>
          </div>
          <div>
            <h4>Customers</h4>
            <ul>
              <li><button className="linkbtn" data-go="home" data-scroll="search" type="button">Search by PIN code</button></li>
              <li><button className="linkbtn" data-go="speed" type="button">Wi-Fi speed test</button></li>
              <li><button className="linkbtn footer-care" data-go="router" type="button">Care plan</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="faq" type="button">FAQ</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="get-app" type="button">Get the app</button></li>
              {user && <li><button className="linkbtn" data-go={ROLE_HOME[user.role] || "my"} type="button">My dashboard</button></li>}
              <li><button className="linkbtn" data-go="home" data-scroll="partners" type="button">Become a DSA or TIP</button></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li>Indore, Madhya Pradesh</li>
              <li>www.connectbhai.com</li>
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
