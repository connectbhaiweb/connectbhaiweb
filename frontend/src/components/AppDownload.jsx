import QRCode from "qrcode";
import { APP_LINKS } from "@/lib/connectbhai/config";

const Ico = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const POINTS = [
  [<Ico key="i"><rect x="4" y="4" width="6" height="16" rx="1.5" /><rect x="14" y="4" width="6" height="16" rx="1.5" /></Ico>, "Compare up to 3 plans", " side by side"],
  [<svg key="i" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#25D366" /><path d="M7.6 16.4l.8-2.6a4.6 4.6 0 111.8 1.7l-2.6.9z" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>, "Book in a minute", " with WhatsApp OTP"],
  [<Ico key="i"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>, "Track installation", " live, step by step"],
  [<Ico key="i"><path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0" /><circle cx="12" cy="19.5" r="1" fill="currentColor" /></Ico>, "Check router status", " and your speed"],
];

function Store({ href, kicker, name, icon, soon }) {
  const body = (<><span className="store-ico" aria-hidden="true">{icon}</span><span className="store-txt"><small>{kicker}</small><b>{name}</b></span></>);
  return href
    ? <a className="store" href={href} target="_blank" rel="noopener noreferrer">{body}</a>
    : <button className="store" type="button" data-act="app-soon" title={soon}>{body}</button>;
}

export default async function AppDownload() {
  const qr = APP_LINKS.qr ? await QRCode.toString(APP_LINKS.qr, { type: "svg", margin: 1, color: { dark: "#0A1B3D", light: "#FFFFFF" } }) : null;
  return (
    <section className="sec appsec" id="get-app" aria-labelledby="app-h">
      <div className="wrap">
        <div className="appcard">
          <div className="app-copy">
            <span className="app-pill">ConnectBhai App</span>
            <h2 id="app-h">Compare, book and track<br />— all from your phone</h2>
            <p className="app-lede">Everything you do on the website, in your pocket. Available on Android and iOS.</p>
            <ul className="app-points">
              {POINTS.map(([icon, b, rest]) => (<li key={b}>{icon}<span><b>{b}</b>{rest}</span></li>))}
            </ul>
            <div className="app-stores">
              <Store href={APP_LINKS.play} kicker="GET IT ON" name="Google Play" soon="Coming soon"
                icon={<svg width="26" height="28" viewBox="0 0 26 28"><path d="M2 1.5l13 12.5L2 26.5c-.6-.4-1-1-1-1.8V3.3c0-.8.4-1.4 1-1.8z" fill="#00C3FF" /><path d="M15 14l4.2-4.2L4.4.6C3.6.2 2.8.8 2 1.5L15 14z" fill="#00E676" /><path d="M15 14L2 26.5c.8.7 1.6 1.2 2.4.9l14.8-9.2L15 14z" fill="#FF3D57" /><path d="M19.2 9.8L15 14l4.2 4.2 4.6-2.8c1.1-.7 1.1-2.1 0-2.8l-4.6-2.8z" fill="#FFC400" /></svg>} />
              <Store href={APP_LINKS.apple} kicker="Download on the" name="App Store" soon="Coming soon"
                icon={<svg width="26" height="30" viewBox="0 0 24 28" fill="#0A1B3D"><path d="M19.6 14.9c0-3 2.5-4.4 2.6-4.5-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1-.9 0-2.4-1.1-4-1-2 0-3.9 1.200-5 3-2.100 3.700-.5 9.200 1.500 12.200 1 1.500 2.200 3.100 3.800 3 1.500-.1 2.100-1 3.900-1s2.400 1 4 .9c1.700 0 2.700-1.500 3.700-3 1.200-1.700 1.600-3.300 1.700-3.400-.1 0-3.200-1.200-3.200-4.900zM16.600 5.900c.8-1 1.400-2.400 1.200-3.800-1.200.1-2.700.8-3.500 1.800-.8.900-1.400 2.300-1.300 3.700 1.400.1 2.800-.7 3.600-1.700z" /></svg>} />
              {qr && (<div className="app-qr"><div className="qr" role="img" aria-label="QR code to download the Connect Bhai app" dangerouslySetInnerHTML={{ __html: qr }} /><span>Scan to<br />download</span></div>)}
            </div>
          </div>
          <div className="app-phones" aria-hidden="true">
            <div className="phone ph1">
              <i className="notch" />
              <b className="ph-t">Compare plans</b><small>2 of 3 selected · 452010</small>
              <div className="ph-cols">
                <div className="ph-col"><em>Best value</em><span className="ph-logo">Jio</span><u>Jio Fiber</u><strong>₹599</strong><small>/month + GST</small><span>100 Mbps</span><span>Unlimited</span><span>Prime +12</span><i className="ph-btn">Book Now</i></div>
                <div className="ph-col"><em>Fastest</em><span className="ph-logo red">airtel</span><u>Airtel</u><strong>₹799</strong><small>/month + GST</small><span>200 Mbps</span><span>Unlimited</span><span>Netflix +15</span><i className="ph-btn">Book Now</i></div>
              </div>
              <div className="ph-add">+ Add a third plan</div>
            </div>
            <div className="phone ph2">
              <i className="notch" />
              <b className="ph-t">Track installation</b><small>Booking #CB-104B2</small>
              <ol className="ph-steps">
                <li className="done"><b>Lead received</b><small>Today, 10:12 am</small></li>
                <li className="done"><b>Partner assigned</b><small>Sharma Networks</small></li>
                <li className="now"><b>Installation scheduled</b><small>Tomorrow, 11 am</small></li>
                <li><b>Installed</b><small>Pending</small></li>
              </ol>
              <div className="ph-router"><i /><span><b>Router online</b><small>98 Mbps · last seen 2 min ago</small></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
