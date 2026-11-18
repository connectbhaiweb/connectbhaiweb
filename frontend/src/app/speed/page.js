import SpeedTest from "@/components/speed/SpeedTest";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({ title: "Free Wi-Fi Speed Test", path: "/speed", description: "Run a free 30-second Wi-Fi speed test on your phone or laptop and check your download speed and latency before choosing a broadband plan." });

export default function SpeedPage() { return <SpeedTest />; }
