import Logo from "./Logo";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <div className="brand" style={{ cursor: "default" }}>
              <Logo height={40} />
            </div>
            <p style={{ marginTop: 8 }}>
              Compare. Choose. Connect. A broadband marketplace for Madhya Pradesh, live in Indore, connecting customers with BSNL TIP partners, Direct Selling Agents and local internet providers.
            </p>
          </div>
          <div>
            <h4>Customers</h4>
            <ul>
              <li><button className="linkbtn" data-go="home" data-scroll="search" type="button">Search by PIN code</button></li>
              <li><button className="linkbtn" data-go="speed" type="button">Wi-Fi speed test</button></li>
              <li><button className="linkbtn" data-go="router" type="button">Care plan (through GenieACS)</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="faq" type="button">FAQ</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="get-app" type="button">Get the app</button></li>
              <li><button className="linkbtn" data-go="my" type="button">My dashboard</button></li>
              <li><button className="linkbtn" data-go="home" data-scroll="partners" type="button">Become a partner</button></li>
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
