/* Side illustrations for the speed-test page (xl screens and up). Hand-drawn SVG, so no image files are needed.
   Replace either component with an <Image> later if a photo or Lottie is preferred. */
const CSS = `
@keyframes sa-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes sa-pulse{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes sa-bar{0%{width:12%}60%,100%{width:92%}}
.sa-bob{animation:sa-bob 4.6s ease-in-out infinite}
.sa-bob2{animation:sa-bob 5.4s ease-in-out -1.6s infinite}
.sa-p1{animation:sa-pulse 2.4s ease-in-out infinite}
.sa-p2{animation:sa-pulse 2.4s ease-in-out .4s infinite}
.sa-p3{animation:sa-pulse 2.4s ease-in-out .8s infinite}
@media (prefers-reduced-motion:reduce){.sa-bob,.sa-bob2,.sa-p1,.sa-p2,.sa-p3{animation:none}}
`;

const SKIN = "#F2B48C", NAVY = "#14275C", BLUE = "#2F7BFF", SKY = "#8DB4FF", CYAN = "#22D3EE", INK = "#0B1738";

/* Left: a person checking their speed on a phone. */
export function SideArtLeft() {
  return (
    <aside aria-hidden="true" className="relative hidden place-items-center xl:grid">
      <style>{CSS}</style>
      <svg viewBox="0 0 360 520" className="h-auto w-full max-w-[340px]" focusable="false">
        <ellipse cx="180" cy="492" rx="110" ry="14" fill="#000" opacity=".28" />
        <circle cx="180" cy="270" r="150" fill="#1450E6" opacity=".16" />
        {/* legs + shoes */}
        <rect x="138" y="350" width="36" height="128" rx="14" fill={NAVY} />
        <rect x="186" y="350" width="36" height="128" rx="14" fill={NAVY} />
        <path d="M128 482c0-9 7-14 18-14h28v16h-46z" fill="#fff" />
        <path d="M232 482c0-9-7-14-18-14h-28v16h46z" fill="#fff" />
        {/* hanging arm */}
        <path d="M134 262c-12 28-16 52-14 80" fill="none" stroke={BLUE} strokeWidth="26" strokeLinecap="round" />
        <circle cx="119" cy="350" r="13" fill={SKIN} />
        {/* torso */}
        <rect x="124" y="228" width="112" height="140" rx="38" fill={BLUE} />
        <path d="M156 228c6 18 42 18 48 0" fill="none" stroke="#1A5CE0" strokeWidth="8" strokeLinecap="round" />
        <rect x="150" y="320" width="60" height="30" rx="12" fill="#1A5CE0" />
        {/* neck + head */}
        <rect x="168" y="204" width="24" height="30" rx="10" fill="#D99A74" />
        <circle cx="180" cy="180" r="40" fill={SKIN} />
        <path d="M140 176c0-30 18-46 42-46 26 0 40 18 38 42-8-14-22-22-40-22-16 0-30 8-40 26z" fill="#1B1B2F" />
        <circle cx="166" cy="184" r="3.6" fill={INK} /><circle cx="194" cy="184" r="3.6" fill={INK} />
        <path d="M168 200c8 8 18 8 26 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="156" cy="196" r="6" fill="#F08A7E" opacity=".45" /><circle cx="204" cy="196" r="6" fill="#F08A7E" opacity=".45" />
        {/* raised arm + phone */}
        <path d="M226 262c28 2 40-14 46-44" fill="none" stroke={BLUE} strokeWidth="26" strokeLinecap="round" />
        <g className="sa-bob2">
          <g transform="rotate(8 292 170)">
            <rect x="256" y="106" width="68" height="116" rx="12" fill={INK} stroke={SKY} strokeWidth="3" />
            <rect x="262" y="116" width="56" height="96" rx="7" fill="#0F2150" />
            <path d="M270 176a20 20 0 0 1 40 0" fill="none" stroke="#1D3A7A" strokeWidth="6" strokeLinecap="round" />
            <path d="M270 176a20 20 0 0 1 28-18" fill="none" stroke={CYAN} strokeWidth="6" strokeLinecap="round" />
            <path d="M290 176l10-12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="290" cy="176" r="3.5" fill="#fff" />
            <rect x="272" y="190" width="36" height="5" rx="2.5" fill={SKY} opacity=".7" />
            <rect x="276" y="200" width="28" height="5" rx="2.5" fill={SKY} opacity=".4" />
          </g>
        </g>
        <circle cx="274" cy="224" r="14" fill={SKIN} />
        {/* wifi waves */}
        <g fill="none" stroke={CYAN} strokeWidth="6" strokeLinecap="round">
          <path className="sa-p1" d="M268 86c14-12 34-12 48 0" /><path className="sa-p2" d="M258 68c20-18 50-18 70 0" /><path className="sa-p3" d="M248 50c26-24 66-24 92 0" />
        </g>
        {/* floating cards */}
        <g className="sa-bob">
          <rect x="22" y="120" width="104" height="44" rx="14" fill="#0F2150" stroke="#2A4796" />
          <path d="M42 134v14m-7-7 7 7 7-7" fill="none" stroke={CYAN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="58" y="134" width="52" height="7" rx="3.5" fill={SKY} /><rect x="58" y="148" width="34" height="6" rx="3" fill="#2A4796" />
        </g>
        <g className="sa-bob2">
          <rect x="30" y="400" width="96" height="42" rx="14" fill="#0F2150" stroke="#2A4796" />
          <circle cx="54" cy="421" r="10" fill="#16A34A" /><path d="m49 421 4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="72" y="414" width="42" height="7" rx="3.5" fill={SKY} /><rect x="72" y="427" width="28" height="6" rx="3" fill="#2A4796" />
        </g>
      </svg>
    </aside>
  );
}

/* Right: router, laptop, TV and gamepad sharing one connection. */
export function SideArtRight() {
  return (
    <aside aria-hidden="true" className="relative hidden place-items-center xl:grid">
      <style>{CSS}</style>
      <svg viewBox="0 0 360 520" className="h-auto w-full max-w-[340px]" focusable="false">
        <ellipse cx="180" cy="492" rx="120" ry="14" fill="#000" opacity=".28" />
        <circle cx="180" cy="260" r="150" fill="#1450E6" opacity=".16" />
        {/* waves */}
        <g fill="none" stroke={CYAN} strokeWidth="6" strokeLinecap="round">
          <path className="sa-p1" d="M148 150c20-16 44-16 64 0" /><path className="sa-p2" d="M132 126c28-24 68-24 96 0" /><path className="sa-p3" d="M116 102c36-32 92-32 128 0" />
        </g>
        {/* router */}
        <g className="sa-bob">
          <path d="M138 214l-10-52M222 214l10-52" stroke={BLUE} strokeWidth="9" strokeLinecap="round" />
          <rect x="96" y="204" width="168" height="62" rx="20" fill={BLUE} />
          <rect x="108" y="214" width="144" height="10" rx="5" fill="#fff" opacity=".18" />
          <circle cx="128" cy="244" r="6" fill="#4ADE80" /><circle cx="150" cy="244" r="6" fill="#fff" /><circle cx="172" cy="244" r="6" fill="#fff" />
          <rect x="200" y="238" width="48" height="12" rx="6" fill="#fff" opacity=".3" />
        </g>
        {/* connection lines */}
        <g fill="none" stroke={SKY} strokeWidth="2.5" strokeDasharray="3 8" strokeLinecap="round" opacity=".7">
          <path d="M150 268v50M210 268v50M180 268v110" />
        </g>
        {/* laptop */}
        <g className="sa-bob2">
          <rect x="52" y="320" width="120" height="78" rx="10" fill={INK} stroke={SKY} strokeWidth="3" />
          <rect x="60" y="328" width="104" height="62" rx="5" fill="#0F2150" />
          <circle cx="112" cy="359" r="15" fill={BLUE} /><path d="m107 351 14 8-14 8z" fill="#fff" />
          <path d="M36 408h152l-10 14H46z" fill="#2A4796" />
        </g>
        {/* TV */}
        <g className="sa-bob">
          <rect x="200" y="318" width="116" height="74" rx="10" fill={INK} stroke={SKY} strokeWidth="3" />
          <rect x="208" y="326" width="100" height="58" rx="5" fill="#0F2150" />
          <path d="M208 372l26-22 20 16 18-14 36 24v8h-100z" fill={BLUE} opacity=".75" />
          <circle cx="288" cy="340" r="6" fill="#FBBF24" />
          <path d="M240 392v14m34-14v14M226 406h62" stroke="#2A4796" strokeWidth="5" strokeLinecap="round" />
        </g>
        {/* gamepad */}
        <g className="sa-bob2">
          <rect x="130" y="404" width="100" height="56" rx="26" fill="#0F2150" stroke="#2A4796" strokeWidth="2" />
          <path d="M156 424v16m-8-8h16" stroke={CYAN} strokeWidth="4" strokeLinecap="round" />
          <circle cx="202" cy="426" r="5" fill={BLUE} /><circle cx="214" cy="438" r="5" fill="#4ADE80" />
        </g>
        {/* speed card */}
        <g className="sa-bob">
          <rect x="228" y="44" width="112" height="58" rx="14" fill="#0F2150" stroke="#2A4796" />
          <text x="244" y="68" fontSize="11" fontWeight="700" fill={SKY} fontFamily="Manrope, system-ui, sans-serif">DOWNLOAD</text>
          <text x="244" y="90" fontSize="20" fontWeight="800" fill="#fff" fontFamily="Sora, Manrope, system-ui, sans-serif">98 Mbps</text>
        </g>
      </svg>
    </aside>
  );
}
