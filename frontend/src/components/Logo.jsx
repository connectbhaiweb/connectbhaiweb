import Image from "next/image";

/* Brand logo. variant="reveal": the BC icon draws in and "Connect Bhai" types out once, then holds (animated WebP,
   loop=1). People who prefer reduced motion get the static PNG. variant="static": always the PNG. */
export default function Logo({ variant = "static", height = 38, priority = false }) {
  const width = Math.round((height * 380) / 82);
  const img = { width, height, className: "logo-img", draggable: false };
  if (variant === "static") return <Image src="/brand/logo-full.png" alt="Connect Bhai" {...img} priority={priority} />;
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet="/brand/logo-full.png" />
      <Image src="/brand/logo-reveal.webp" alt="Connect Bhai" {...img} unoptimized priority={priority} />
    </picture>
  );
}
