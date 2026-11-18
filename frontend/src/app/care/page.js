import ViewRoute from "@/components/ViewRoute";
import SeoIntro from "@/components/SeoIntro";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({ title: "Connect Bhai Care Plan: Router and Wi-Fi Help", path: "/care", description: "Watch your router through Genie, restart it from the app and fix Wi-Fi problems without booking a complaint. Care plan for Indore broadband users." });

export default function CarePage() {
  return (
    <>
      <SeoIntro title="Connect Bhai Care plan">
        <p>The Connect Bhai Care plan lets you watch your home modem through Genie, your personal assistant. You can see whether your router is online, check your Wi-Fi and restart the router from your phone, so a stuck Wi-Fi does not need a complaint.</p>
        <p>Modem status is shown to the customer, the installing TIP and admin. Log in to use the Care plan.</p>
      </SeoIntro>
      <ViewRoute view="care" />
    </>
  );
}
