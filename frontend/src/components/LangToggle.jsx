"use client";
import { useSyncExternalStore } from "react";
import { getLang, setLang, subscribeLang } from "@/lib/i18n/engine";

/* English / Hindi switch (header and dashboard top bar). The highlighted side is the language shown now; a click switches to the other. */
export default function LangToggle({ className = "" }) {
  const lang = useSyncExternalStore(subscribeLang, getLang, () => "en");
  const toHindi = lang === "en";
  return (
    <button type="button" data-no-translate className={`lang-toggle ${className}`.trim()} onClick={() => setLang(toHindi ? "hi" : "en")}
      aria-label={toHindi ? "हिन्दी में देखें (Switch to Hindi)" : "Switch to English (अंग्रेज़ी में देखें)"} lang={toHindi ? "hi" : "en"}>
      <span className={toHindi ? "is-on" : ""} aria-hidden="true">EN</span><i aria-hidden="true" /><span className={toHindi ? "" : "is-on"} aria-hidden="true">हिं</span>
    </button>
  );
}
