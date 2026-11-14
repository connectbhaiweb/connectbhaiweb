import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Account Deletion | Connect Bhai" };

export default function Page() {
  return (
    <LegalPage title="Account Deletion" updated="Last updated: 14 November 2026">
      <p>You can ask us to delete your Connect Bhai account and personal data.</p>
      <h2>How to ask</h2>
      <ul>
        <li>Call or WhatsApp +91 94799 35365 from the mobile number on your account, or write to support@connectbhai.in from your registered email.</li>
        <li>Tell us your name, mobile number and that you want the account deleted.</li>
        <li>We confirm it is you, delete the account and tell you on WhatsApp.</li>
      </ul>
      <h2>What happens</h2>
      <ul>
        <li>Your profile, messages and Care plan data are removed.</li>
        <li>Invoices and payment records we must keep by law stay, without your profile linked to them.</li>
        <li>Open connection requests are cancelled. Partners with pending payouts are settled first.</li>
      </ul>
    </LegalPage>
  );
}
