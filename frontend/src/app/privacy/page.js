import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Privacy Policy | Connect Bhai" };

export default function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="Last updated: 14 November 2026">
      <p>Connect Bhai helps you compare broadband plans by PIN code in Indore and request a connection. This page explains what we collect and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name, mobile number, email, address and PIN code when you request a connection or create an account.</li>
        <li>For DSA and TIP partners: KYC and bank details. These are stored encrypted and only the last 4 digits are shown.</li>
        <li>Messages, tickets and Care plan readings (modem status, Wi-Fi name and speed tests) linked to your connection.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To show plans for your area, pass your request to the DSA and TIP who serve your PIN code, and book the installation.</li>
        <li>To send WhatsApp, SMS and email messages about your request, payments and support.</li>
        <li>To take payments online through Razorpay (UPI, cards and net banking). We do not store your card details.</li>
      </ul>
      <h2>Sharing</h2>
      <p>We share your details only with the DSA, TIP and provider handling your connection, and with payment and messaging services needed to serve you. We do not sell your data.</p>
      <h2>Your choices</h2>
      <p>You can ask us to correct your details or delete your account at any time. See the Account Deletion page, or call or WhatsApp +91 94799 35365.</p>
    </LegalPage>
  );
}
