import { LIVE } from "@/lib/connectbhai/config";

/* Shown only while the app runs on the in-browser demo back end. Buttons are handled by the delegated data-act handlers. */
export default function DemoBar() {
  return (
    <div className="demobar" id="demobar" hidden={LIVE}>
      <div className="wrap">
        <span>
          <b>Prototype · demo data.</b><span className="demo-more"> Plans are samples, not real ISP offers. Demo WhatsApp OTP is 123456. Care plan (through GenieACS) features are simulated until GenieACS is linked.</span>
        </span>
        <button className="linkbtn" data-act="login" type="button">Try a role</button>
        <button className="linkbtn" data-act="reset-demo" type="button">Reset demo data</button>
      </div>
    </div>
  );
}
