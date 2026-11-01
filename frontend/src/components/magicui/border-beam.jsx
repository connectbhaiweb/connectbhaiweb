"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/* Magic UI · Border Beam. A glowing dot that runs around the border of its (position:relative) parent. */
export function BorderBeam({ className, size = 60, delay = 0, duration = 6, colorFrom = "#3D7BFF", colorTo = "#22D3EE", transition, style, reverse = false, initialOffset = 0, borderWidth = 1.5 }) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ borderWidth: `${borderWidth}px`, borderStyle: "solid" }}>
      <motion.div
        className={cn("absolute aspect-square bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent", className)}
        style={{ width: size, offsetPath: `rect(0 auto auto 0 round ${size}px)`, "--color-from": colorFrom, "--color-to": colorTo, ...style }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{ offsetDistance: reverse ? [`${100 - initialOffset}%`, `${-initialOffset}%`] : [`${initialOffset}%`, `${100 + initialOffset}%`] }}
        transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay, ...transition }} />
    </div>
  );
}
