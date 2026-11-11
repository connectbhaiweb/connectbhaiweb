/* Connect Bhai · data layer entry point.
   Three interchangeable back ends expose the SAME method names and shapes:
     Rest  (./rest.js)  – the NestJS + MySQL API. Used when NEXT_PUBLIC_API_URL is set (staging / production).
     Live  (./demo.js)  – Supabase.
     Demo  (./demo.js)  – in-browser copy of the schema (prototype / preview).
   NEXT_PUBLIC_API_URL is replaced with its value at build time, so a build for the real API leaves the demo and Supabase
   code out of the page entirely (it used to be ~125 KB of script the browser downloaded and ran for nothing).
   Shared helpers, labels and constants live in ./base.js and are re-exported from here. Browser-only. */
import { LIVE } from "./config";
import { ROLE_NAME } from "./shared";
import { AppError, BOOK_NEXT } from "./base";

export * from "./base";

const REST_BUILD = !!process.env.NEXT_PUBLIC_API_URL;
const D = REST_BUILD ? null : require("./demo");
const Rest = REST_BUILD ? require("./rest").createRest({ AppError, BOOK_NEXT, ROLE_NAME }) : null;
const Demo = D ? D.Demo : null, Live = D ? D.Live : null;
const API = REST_BUILD ? Rest : LIVE ? Live : Demo;

/* Demo-only helpers: no-ops when the real API is connected (the screens only call them on the demo path). */
const noop = () => {};
const DEMO_KEY = D ? D.DEMO_KEY : "cb-demo-v6";
const loadDemo = D ? D.loadDemo : noop, migrateCities = D ? D.migrateCities : noop, resetDemoData = D ? D.resetDemoData : noop;
const saveDemo = D ? D.saveDemo : noop, seedDemo = D ? D.seedDemo : noop, demoHash = D ? D.demoHash : noop, genTempPw = D ? D.genTempPw : noop;

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") window.__cbApi = API;   // dev only: lets you poke the data layer from the browser console

export { API, Rest, Demo, Live, DEMO_KEY, loadDemo, migrateCities, resetDemoData, saveDemo, seedDemo, demoHash, genTempPw };
