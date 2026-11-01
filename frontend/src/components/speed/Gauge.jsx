import { NumberTicker } from "@/components/magicui/number-ticker";

/* Speed gauge: 270° sweep, 0 at bottom-left, 100 Mbps at the top, 300+ at bottom-right (same non-linear scale as the original). */
const SCALE = [25, 50, 100, 150, 200, 300];
export const pctOf = m => Math.min(100, m <= 100 ? m / 2 : 50 + (Math.min(m, 300) - 100) / 4);
const ang = pct => -135 + pct * 2.7;
const xy = (r, a) => { const t = (a - 90) * Math.PI / 180; return [150 + r * Math.cos(t), 150 + r * Math.sin(t)]; };
const arc = r => { const [x0, y0] = xy(r, ang(0)), [x1, y1] = xy(r, ang(100)); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };

const TICKS = Array.from({ length: 41 }, (_, i) => {
  const major = i % 5 === 0, a = ang(i * 2.5), [x0, y0] = xy(major ? 98 : 103, a), [x1, y1] = xy(112, a);
  return <line key={i} x1={x0.toFixed(1)} y1={y0.toFixed(1)} x2={x1.toFixed(1)} y2={y1.toFixed(1)} stroke="#9FB8F2" strokeOpacity={major ? 0.85 : 0.4} strokeWidth={major ? 2.2 : 1.2} strokeLinecap="round" />;
});
const LABELS = SCALE.map(v => { const [x, y] = xy(82, ang(pctOf(v))); return <text key={v} x={x.toFixed(1)} y={(y + 4.5).toFixed(1)} textAnchor="middle" fontSize="13" fontWeight="700" fill="#DCE7FF">{v}</text>; });

export default function Gauge({ value, running, done }) {
  const pct = pctOf(value);
  return (
    <div className="relative mx-auto w-full [container-type:inline-size]" style={{ aspectRatio: "300 / 262" }}>
      <div aria-hidden="true" className={"pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(closest-side,rgba(34,160,255,.28),transparent)] blur-xl " + (running ? "animate-[sp-glow_1.6s_ease-in-out_infinite]" : "animate-[sp-breathe_4s_ease-in-out_infinite]")} />
      <svg viewBox="0 0 300 262" className="relative block h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="spArc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#1D6BFF" /><stop offset=".55" stopColor="#22B8FF" /><stop offset="1" stopColor="#2EF0C2" /></linearGradient>
        </defs>
        <path d={arc(128)} fill="none" stroke="#7FA2FF" strokeOpacity=".16" strokeWidth="15" strokeLinecap="round" />
        <path d={arc(128)} fill="none" stroke="url(#spArc)" strokeWidth="15" strokeLinecap="round" pathLength="100"
          strokeDasharray={`${pct.toFixed(1)} 100`} style={{ transition: "stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 7px rgba(34,211,238,.75))" }} />
        {TICKS}{LABELS}
        <g style={{ transform: `rotate(${ang(pct).toFixed(1)}deg)`, transformOrigin: "150px 150px", transition: "transform .9s cubic-bezier(.2,.9,.3,1.18)" }}>
          <path d="M150 150 L150 56" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,.7))" }} />
        </g>
        <circle cx="150" cy="150" r="14" fill="#22D3EE" fillOpacity=".25" />
        <circle cx="150" cy="150" r="9" fill="#22D3EE" style={{ filter: "drop-shadow(0 0 6px #22D3EE)" }} />
        <circle cx="150" cy="150" r="3.6" fill="#06142F" />
      </svg>
      <div className="pointer-events-none absolute left-1/2 top-[61%] -translate-x-1/2 text-center leading-none">
        <div className="font-display font-extrabold text-white [font-size:17cqw]" aria-live="off"><NumberTicker value={Math.round(value)} className="!tracking-tight" /></div>
        <div className="mt-[1.5cqw] font-display font-bold text-[#4FA8FF] [font-size:6.4cqw]">Mbps</div>
      </div>
      {done && <span className="sr-only">Download speed {Math.round(value)} megabits per second</span>}
    </div>
  );
}
