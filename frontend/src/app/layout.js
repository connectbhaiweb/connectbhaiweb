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
import DemoBar from "@/components/DemoBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompareBar from "@/components/CompareBar";
import Overlays from "@/components/Overlays";
import StoryTemplate from "@/components/StoryTemplate";
import ConnectBhaiRuntime from "@/components/ConnectBhaiRuntime";

export const metadata = {
  title: "Connect Bhai",
  description: "Connect Bhai: compare broadband plans by PIN code in Indore and request a connection. Compare. Choose. Connect.",
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN">
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
        <ConnectBhaiRuntime />
      </body>
    </html>
  );
}
