import Image from "next/image";

/* Brand logo. variant="reveal": the BC icon draws in and "Connect Bhai" types out once, then holds (animated WebP,
   loop=1). People who prefer reduced motion get the static PNG. variant="static": always the PNG. */
export default function Logo({ variant = "static", height = 38, priority = false }) {
  const width = Math.round((height * 380) / 82);
  // width:auto + an explicit height keeps the aspect ratio (and silences next/image's resize warning); --logo-h lets CSS shrink it on phones
  const img = { width, height, className: "logo-img", draggable: false, style: { height: `var(--logo-h, ${height}px)`, width: "auto" } };
  if (variant === "static") return <Image src="/brand/logo-full.png" alt="Connect Bhai" {...img} unoptimized priority={priority} />;
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet="/brand/logo-full.png" />
      <Image src="/brand/logo-reveal.webp" alt="Connect Bhai" {...img} unoptimized priority={priority} />
    </picture>
  );
}
