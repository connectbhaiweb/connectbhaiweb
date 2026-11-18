import ViewRoute from "@/components/ViewRoute";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({ title: "Connect Bhai Care Plan: Router and Wi-Fi Help", path: "/care", description: "Watch your router through Genie, restart it from the app and fix Wi-Fi problems without booking a complaint. Care plan for Indore broadband users." });

export default function CarePage() { return <ViewRoute view="care" />; }
