"use client";
import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";

/* Floating "Compare" bar, visible on the plans page while 1–3 plans are ticked. */
export default function CompareBar() {
  const { compareCount: n, showCompare } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div className="cmpbar" id="cmpbar" hidden={!showCompare}>
      <b id="cmpcount">{n} selected{n < 2 ? " · pick 2–3" : ""}</b>
      <button className="btn btn-primary btn-sm" data-act="open-compare" type="button">Compare</button>
      <button className="btn btn-ghost btn-sm" data-act="clear-compare" type="button">Clear</button>
    </div>
  );
}
