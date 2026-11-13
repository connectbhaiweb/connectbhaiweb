import { ArrowDownToLine, ArrowUpFromLine, Gamepad2, MonitorPlay, Video, Wifi } from "lucide-react";

/* Decorative side panels for the speed-test page (large screens only). Each is a self-contained slot: swap the contents
   for any image / Lottie / video later without touching the page layout. */
const KEYFRAMES = `
@keyframes sp-ring{0%{transform:scale(.55);opacity:.7}100%{transform:scale(1.5);opacity:0}}
@keyframes sp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes sp-flow{0%{transform:translateY(-6px);opacity:0}20%,80%{opacity:1}100%{transform:translateY(70px);opacity:0}}
@keyframes sp-flow-up{0%{transform:translateY(70px);opacity:0}20%,80%{opacity:1}100%{transform:translateY(-6px);opacity:0}}
@media (prefers-reduced-motion:reduce){.sp-anim{animation:none!important}}
`;

function Chip({ Icon, className = "", delay = 0 }) {
  return (
    <span aria-hidden="true" className={`sp-anim absolute grid size-12 place-items-center rounded-2xl border border-white/15 bg-[#0F2150]/80 text-sky-200 shadow-[0_10px_30px_-10px_rgba(34,211,238,.45)] backdrop-blur ${className}`} style={{ animation: `sp-bob 4.2s ease-in-out ${delay}s infinite` }}>
      <Icon className="size-6" />
    </span>
  );
}

export function SideArtLeft() {
  return (
    <aside aria-hidden="true" className="relative hidden min-h-[360px] place-items-center xl:grid">
      <style>{KEYFRAMES}</style>
      {[0, 1.1, 2.2].map(d => <span key={d} className="sp-anim absolute size-44 rounded-full border border-cyan-300/40" style={{ animation: `sp-ring 3.3s ease-out ${d}s infinite` }} />)}
      <span className="relative grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-[#2F7BFF] to-[#22D3EE] text-white shadow-[0_0_40px_rgba(34,211,238,.5)]"><Wifi className="size-10" /></span>
      <Chip Icon={MonitorPlay} className="left-1 top-10" delay={0} />
      <Chip Icon={Gamepad2} className="right-2 top-28" delay={.9} />
      <Chip Icon={Video} className="bottom-12 left-6" delay={1.8} />
    </aside>
  );
}

export function SideArtRight() {
  return (
    <aside aria-hidden="true" className="relative hidden min-h-[360px] place-items-center xl:grid">
      <style>{KEYFRAMES}</style>
      <div className="relative h-[280px] w-24">
        <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
        {[0, 1.2, 2.4].map(d => <ArrowDownToLine key={d} className="sp-anim absolute left-[22%] top-6 size-6 text-sky-300" style={{ animation: `sp-flow 3.6s ease-in ${d}s infinite` }} />)}
        {[.6, 1.8, 3].map(d => <ArrowUpFromLine key={d} className="sp-anim absolute right-[22%] top-24 size-6 text-cyan-300" style={{ animation: `sp-flow-up 3.6s ease-in ${d}s infinite` }} />)}
        <span className="sp-anim absolute inset-x-0 bottom-0 grid h-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1450E6] to-[#2F7BFF] shadow-[0_0_34px_rgba(47,123,255,.55)]" style={{ animation: "sp-bob 4.2s ease-in-out infinite" }}>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-400" /><i className="size-2 rounded-full bg-white" /><i className="size-2 rounded-full bg-white" /></span>
        </span>
      </div>
    </aside>
  );
}
