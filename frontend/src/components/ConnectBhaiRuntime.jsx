"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseLegacyHash, pathFor } from "@/lib/connectbhai/shared";

/* Boots the browser-only app module once per page load and hands it the Next.js router.
   Renders nothing. Also forwards old hash URLs (#my-bookings → /my/bookings) so existing shared links keep working. */
export default function ConnectBhaiRuntime() {
  const router = useRouter();

  useEffect(() => {
    const legacy = parseLegacyHash(window.location.hash);
    if (legacy) router.replace(pathFor(legacy.view, legacy.tab), { scroll: false });

    let dispose = null, cancelled = false;
    import("@/lib/connectbhai/ui").then(ui => {
      if (cancelled) return;
      dispose = ui.init({ navigate: (path, mode) => router[mode](path, { scroll: false }) });
    });
    return () => { cancelled = true; if (dispose) dispose(); };
  }, [router]);

  return null;
}
