"use client";
import { useEffect } from "react";
import { startLang } from "@/lib/i18n/engine";

/* Starts the English / Hindi engine once the page has hydrated (so server and browser markup match). */
export default function LangRuntime() {
  useEffect(() => { startLang(); }, []);
  return null;
}
