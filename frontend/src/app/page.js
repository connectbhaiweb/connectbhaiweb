import ViewRoute from "@/components/ViewRoute";
import AppDownload from "@/components/AppDownload";
import Faq from "@/components/Faq";
import { ITEMS } from "@/lib/faqData";
import { BUSINESS_ADDRESS, BUSINESS_AREAS, SOCIAL_FACEBOOK, SOCIAL_INSTAGRAM, SUPPORT_PHONE_E164 } from "@/lib/contact";

const SITE = "https://www.connectbhai.com";
/* Structured data for Google: local business, service and FAQ (same questions the page shows). */
const SCHEMA = [
  {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: "Connect Bhai", url: SITE, telephone: SUPPORT_PHONE_E164,
    description: "Compare BSNL, Jio, Airtel and local ISP fiber, SIM, TV and OTT plans by PIN code in Indore. Book a connection and get Connect Bhai Care.",
    address: { "@type": "PostalAddress", streetAddress: "215-A, Mahalaxmi Nagar", addressLocality: "Indore", addressRegion: "Madhya Pradesh", postalCode: "452010", addressCountry: "IN" },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "08:00", closes: "18:00" }],
    areaServed: BUSINESS_AREAS.map(name => ({ "@type": "City", name })), sameAs: [SOCIAL_FACEBOOK, SOCIAL_INSTAGRAM],
  },
  {
    "@context": "https://schema.org", "@type": "Service", serviceType: "Broadband plan comparison and installation", name: "Connect Bhai broadband marketplace",
    provider: { "@type": "LocalBusiness", name: "Connect Bhai", url: SITE }, areaServed: BUSINESS_AREAS.map(name => ({ "@type": "City", name })),
    availableChannel: { "@type": "ServiceChannel", serviceUrl: SITE, servicePostalAddress: { "@type": "PostalAddress", streetAddress: BUSINESS_ADDRESS, addressCountry: "IN" } },
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: ITEMS.map(([, q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
];

/* The plans/search/results view paints itself into <main id="app">; these two sections are server-rendered React. */
export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA).replace(/</g, "\\u003c") }} />
      <ViewRoute view="home" />
      <AppDownload />
      <Faq />
    </>
  );
}
