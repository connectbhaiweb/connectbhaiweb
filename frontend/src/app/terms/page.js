import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Terms of Service | Connect Bhai" };

export default function Page() {
  return (
    <LegalPage title="Terms of Service" updated="Last updated: 14 November 2026">
      <p>By using Connect Bhai you agree to these terms.</p>
      <h2>Our role</h2>
      <p>Connect Bhai is an independent marketplace. Plans are offered by providers and installed by TIP partners. Plan prices, speeds and benefits are set by the provider and can change.</p>
      <h2>Your account</h2>
      <ul>
        <li>Give correct details and keep your login private.</li>
        <li>Requesting a connection is free. Any fee is shown in your dashboard before you pay.</li>
        <li>Use the Care plan, speed test and chat only for your own connection.</li>
      </ul>
      <h2>Partners</h2>
      <p>DSA and TIP partners are verified by our admin team before they receive leads. Partners must follow the lead flow, fees and payouts shown in their dashboard.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: call or WhatsApp +91 94799 35365, or write to support@connectbhai.in.</p>
    </LegalPage>
  );
}
