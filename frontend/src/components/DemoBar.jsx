import { LIVE } from "@/lib/connectbhai/config";

/* Top strip. In demo mode it explains the sample data; when NEXT_PUBLIC_API_URL is set it also shows live API + MySQL status. */
export default function DemoBar() {
  const api = !!process.env.NEXT_PUBLIC_API_URL;
  return (
    <div className="demobar" id="demobar" hidden={LIVE}>   {/* never shown on a live API: the old "OTP in development is 123456" text was wrong there */}
      <div className="wrap">
        {!api && (
          <>
            <span>
              <b>Prototype · demo data.</b><span className="demo-more"> Plans are samples, not real ISP offers. Demo WhatsApp OTP is 123456. Care plan (through GenieACS) features are simulated until GenieACS is linked.</span>
            </span>
            <button className="linkbtn" data-act="login" type="button">Try a role</button>
            <button className="linkbtn" data-act="reset-demo" type="button">Reset demo data</button>
          </>
        )}
        {api && <span><b>Connected to the Connect Bhai API.</b><span className="demo-more"> OTP in development is 123456.</span></span>}
      </div>
    </div>
  );
}
