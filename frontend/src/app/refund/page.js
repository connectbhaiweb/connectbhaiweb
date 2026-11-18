import LegalPage from "@/components/LegalPage";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({ title: "Refund Policy", path: "/refund", description: "How refunds work for payments made on Connect Bhai: how to ask for one, how we check it and what is not refundable." });

export default function Page() {
  return (
    <LegalPage title="Refund Policy" updated="Last updated: 14 November 2026">
      <p>This page explains how refunds work for payments made on Connect Bhai.</p>
      <h2>What you pay for</h2>
      <p>Requesting a connection is free. When a payment is due, such as an installation or equipment charge, it appears in your Payments page with the amount and GST.</p>
      <h2>Asking for a refund</h2>
      <ul>
        <li>Raise a request from Support in your dashboard, or call or WhatsApp +91 94799 35365, with your reference code.</li>
        <li>We check the payment and the installation status, and tell you the result on WhatsApp.</li>
        <li>An approved refund goes back to the payment method you used.</li>
      </ul>
      <h2>Not refundable</h2>
      <p>Services already delivered, such as a completed installation, are not refunded unless the work was not done properly. Plan charges paid to your internet provider follow the rules of that provider.</p>
    </LegalPage>
  );
}
