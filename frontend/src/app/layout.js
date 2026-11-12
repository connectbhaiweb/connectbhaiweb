import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import "./dashboard.css";
import "./customer.css";
import "./portal.css";
import "./legacy-dash.css";
import DemoBar from "@/components/DemoBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompareBar from "@/components/CompareBar";
import Overlays from "@/components/Overlays";
import StoryTemplate from "@/components/StoryTemplate";
import ConnectBhaiRuntime from "@/components/ConnectBhaiRuntime";
import TableTools from "@/components/TableTools";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata = {
  title: "Connect Bhai",
  description: "Connect Bhai: compare broadband plans by PIN code in Indore and request a connection. Compare. Choose. Connect.",
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* signed-in on a dashboard URL: hide the site header/footer from the first paint (DashboardShell clears this once the session is known) */}
        <script dangerouslySetInnerHTML={{ __html: `try{var p=location.pathname.split("/")[1];if(/^(my|dsa|tip|admin)$/.test(p)&&(localStorage.getItem("cb-session")||Object.keys(localStorage).some(function(k){return k.indexOf("sb-")===0})))document.documentElement.setAttribute("data-shell-pending",p);if(p===""&&/^(dsa|tip|admin)$/.test(localStorage.getItem("cb-role")||"")&&localStorage.getItem("cb-session"))document.documentElement.setAttribute("data-entering","")}catch(e){}` }} />
      </head>
      <body>
        <DemoBar />
        <Header />
        {/* Legacy views paint into #app; route components (children) render after it (home: app download + FAQ). */}
        <main id="app" />
        {children}
        <Footer />
        <CompareBar />
        <Overlays />
        <StoryTemplate />
        <DashboardShell />
        <ConnectBhaiRuntime />
        <TableTools />
      </body>
    </html>
  );
}
