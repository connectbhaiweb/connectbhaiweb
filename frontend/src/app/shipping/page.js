import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Shipping Policy | Connect Bhai" };

export default function Page() {
  return (
    <LegalPage title="Shipping Policy" updated="Last updated: 14 November 2026">
      <p>Connect Bhai sells connections, not parcels. Most orders need no shipping.</p>
      <h2>Installation</h2>
      <p>After you request a connection, a TIP partner calls you and visits your address. Installation is done the same day.</p>
      <h2>Equipment</h2>
      <p>If your plan includes a router or other equipment, the installer brings it and sets it up at your address. Equipment is not sent by courier.</p>
      <h2>Service area</h2>
      <p>We serve Indore, Depalpur, Mhow and Sanwer. Enter your PIN code on the home page to check your area.</p>
      <h2>Need help?</h2>
      <p>Call or WhatsApp +91 94799 35365, open daily, 08:00 to 18:00.</p>
    </LegalPage>
  );
}
