import { Clock, Headphones, Phone, Scale, ShieldCheck } from "lucide-react";
import { SUPPORT_PHONE_E164, SUPPORT_PHONE_TEXT } from "@/lib/contact";

/* Thin strip above the header: four promises on the left, the support number on the right (tap to call on phones). */
const ITEMS = [
  [ShieldCheck, "Verified Providers"],
  [Scale, "Unbiased Comparison"],
  [Clock, "Quick Installation"],
  [Headphones, "Free Expert Assistance"],
];
export default function TrustBar() {
  return (
    <div className="trustbar" id="trustbar">
      <div className="wrap trustbar-in">
        <ul className="trustbar-list">
          {ITEMS.map(([Icon, label]) => (
            <li key={label}><Icon aria-hidden="true" />{label}</li>
          ))}
        </ul>
        <a className="trustbar-call" href={`tel:${SUPPORT_PHONE_E164}`} aria-label={`Call Connect Bhai on ${SUPPORT_PHONE_TEXT}`}>
          <Phone aria-hidden="true" /><span>{SUPPORT_PHONE_TEXT}</span>
        </a>
      </div>
    </div>
  );
}
