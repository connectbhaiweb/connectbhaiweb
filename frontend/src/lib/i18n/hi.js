/* Hindi dictionary: English text on the page -> Hindi. Brand and role names stay in English (Connect Bhai, BSNL, Genie, TIP, DSA).
   The big lists live in hi-*.js; PATTERNS hold sentences that need code to build (rare). */
import site from "./hi-site";
import dash from "./hi-dash";
import admin from "./hi-admin";
import legacyA from "./hi-legacyA";
import legacyB from "./hi-legacyB";
import legacyC from "./hi-legacyC";
import legacyD from "./hi-legacyD";
import { EXTRA, EXTRA_PATTERNS, PLACES } from "./hi-extra";

export const EXACT = { ...legacyA, ...legacyB, ...legacyC, ...legacyD, ...site, ...dash, ...admin, ...PLACES, ...EXTRA };
export const PATTERNS = EXTRA_PATTERNS;
