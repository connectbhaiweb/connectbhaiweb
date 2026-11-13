"use client";
import { SideArtLeft, SideArtRight } from "./SideArt";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Activity, Check, Clock, Download, Gamepad2, Laptop, MonitorPlay, Tag, Timer, Upload, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { BorderBeam } from "@/components/magicui/border-beam";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import Gauge from "./Gauge";

/* Wi-Fi speed test (React). The measuring uses the same Cloudflare speed-test module and measurement plan as before. */
const PLAN = [{ type: "latency", numPackets: 1 }, { type: "download", bytes: 1e5, count: 1, bypassMinDuration: true }, { type: "latency", numPackets: 20 }, { type: "download", bytes: 1e5, count: 8 }, { type: "download", bytes: 1e6, count: 8 }, { type: "upload", bytes: 1e5, count: 8 }, { type: "upload", bytes: 1e6, count: 6 }, { type: "download", bytes: 1e7, count: 6 }, { type: "upload", bytes: 1e7, count: 4 }, { type: "download", bytes: 2.5e7, count: 4 }];
const glass = "border-white/10 bg-white/[.045] text-white shadow-none backdrop-blur-md";
const lift = "hover:border-cyan-300/50 hover:bg-white/[.08] hover:shadow-cyan-400/20";
const f1 = v => (v == null ? "–" : Number(v).toFixed(1));

const quality = d => d >= 100 ? ["Excellent connection", "text-emerald-300 border-emerald-400/40 bg-emerald-500/15"] : d >= 40 ? ["Good connection", "text-sky-300 border-sky-400/40 bg-sky-500/15"] : d >= 10 ? ["Slow connection", "text-amber-300 border-amber-400/40 bg-amber-500/15"] : ["Very slow connection", "text-rose-300 border-rose-400/40 bg-rose-500/15"];
/* rough guide: what each use needs from the line (download Mbps / max ping ms) */
const USES = [
  { k: "4K streaming", Icon: MonitorPlay, need: 25 },
  { k: "Video calls", Icon: Video, need: 10 },
  { k: "Online gaming", Icon: Gamepad2, need: 15, ping: 50 },
  { k: "Work from home", Icon: Laptop, need: 20 },
];
const fit = (u, r) => { if (!r) return null; const ok = r.down >= u.need && (!u.ping || r.ping <= u.ping); return ok ? "Smooth" : r.down >= u.need * 0.5 ? "Limited" : "Too slow"; };
const fitCls = { Smooth: "text-emerald-300", Limited: "text-amber-300", "Too slow": "text-rose-300" };

function Pill({ Icon, children }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl border px-4 py-2 text-[15px] font-semibold transition-all duration-200 ${glass} ${lift} hover:-translate-y-0.5 max-lg:flex-1 max-lg:flex-col max-lg:gap-1 max-lg:px-2 max-lg:py-2 max-lg:text-center max-lg:text-[12.5px]`}>
      <Icon className="size-5 shrink-0 text-sky-300 max-lg:size-4" aria-hidden="true" />{children}
    </li>
  );
}

export default function SpeedTest() {
  const { user } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [status, setStatus] = useState("idle");      // idle | running | done | error
  const [phase, setPhase] = useState("Ready · tap the dial to start");
  const [step, setStep] = useState(0);               // 1 ping, 2 download, 3 upload, 4 done
  const [live, setLive] = useState(0);
  const [res, setRes] = useState({ down: null, up: null, ping: null, jit: null });
  const [conns, setConns] = useState([]);
  const [conn, setConn] = useState("");
  const bridge = useRef(null);
  const last = useRef(null);
  const stage = useRef(null);

  const getBridge = useCallback(async () => (bridge.current ||= (await import("@/lib/connectbhai/ui")).speedBridge), []);

  useEffect(() => {          // saved-connection picker follows login/logout
    let off = false;
    getBridge().then(async b => { const c = await b.connections(); if (!off) { setConns(c); setConn(c[0]?.id || ""); } });
    return () => { off = true; };
  }, [user, getBridge]);

  const finish = useCallback(async r => {
    last.current = r; setRes({ down: r.down, up: r.up, ping: r.ping, jit: r.jit }); setLive(r.down || 0);
    setPhase("Test complete"); setStep(4); setStatus("done");
    const b = await getBridge();
    if (b.user()) { try { await b.save(conn, r); b.toast("Result saved" + (conns.length ? " to your connection." : ".")); } catch (e) { b.toast(b.errMsg(e), true); } }
  }, [conn, conns.length, getBridge]);

  const run = useCallback(async () => {
    if (status === "running") return;
    setStatus("running"); setStep(0); setLive(0); setRes({ down: null, up: null, ping: null, jit: null }); setPhase("Connecting to the test server…");
    const fail = msg => { setStep(0); setPhase(msg); setStatus("error"); };
    try {
      const m = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "https://cdn.jsdelivr.net/npm/@cloudflare/speedtest@1.3.0/+esm");
      const SpeedTest = m.default || m.SpeedTest;
      const st = new SpeedTest({ autoStart: false, measurements: PLAN });
      st.onResultsChange = ({ type }) => {
        const r = st.results;
        if (type === "download") { setPhase("Checking download…"); setStep(2); const d = r.getDownloadBandwidth(); if (d) { setLive(d / 1e6); setRes(p => ({ ...p, down: d / 1e6 })); } }
        else if (type === "upload") { setPhase("Checking upload…"); setStep(3); const u = r.getUploadBandwidth(); if (u) { setLive(u / 1e6); setRes(p => ({ ...p, up: u / 1e6 })); } }
        else if (type === "latency") { setPhase("Checking ping…"); setStep(1); const l = r.getUnloadedLatency(); if (l) setRes(p => ({ ...p, ping: l })); }
      };
      st.onFinish = r => { const x = r.getSummary(); finish({ down: x.download / 1e6, up: x.upload / 1e6, ping: x.latency, jit: x.jitter }); };
      st.onError = () => fail("The test stopped. Check your internet and try again.");
      st.play();
    } catch (e) { fail("Could not load the speed test. Check your internet and try again."); }
  }, [status, finish]);

  const running = status === "running", done = status === "done";
  useEffect(() => {
    if (status !== "running" || window.innerWidth >= 1024 || !stage.current) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stage.current.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }, [status]);
  const [qLabel, qCls] = done ? quality(res.down || 0) : [phase, "text-white border-white/20 bg-white/10"];
  const stats = [["Download", Download, res.down, "Mbps", 1], ["Upload", Upload, res.up, "Mbps", 1], ["Ping", Clock, res.ping, "ms", 0], ["Jitter", Activity, res.jit, "ms", 0]];
  const onDialKey = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); } };

  return (
    <section className="relative isolate overflow-hidden bg-[#050B1F] text-white" aria-labelledby="sp-h">
      <style>{"#app{display:none}"}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_55%_at_50%_38%,rgba(29,107,255,.22),transparent_70%),radial-gradient(40%_40%_at_8%_70%,rgba(20,80,230,.18),transparent_70%)]" />
      <div className="mx-auto grid w-full max-w-[1640px] items-center gap-4 px-4 py-4 sm:px-6 lg:py-5 xl:grid-cols-[minmax(220px,1fr)_minmax(0,2.6fr)_minmax(220px,1fr)] xl:gap-10">
      <SideArtLeft />
      <div className="grid min-w-0 gap-4">

        <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,.8fr)] lg:gap-6">
          {/* left: copy + start */}
          <div className="grid gap-4 max-lg:justify-items-center max-lg:text-center lg:order-1">
            <div>
              <p className="text-[13px] font-extrabold uppercase tracking-[.16em] text-[#3D8BFF]">Wi-Fi speed test</p>
              <h1 id="sp-h" className="mt-2 font-display font-extrabold leading-[1.08] [font-size:clamp(28px,3.4vw,46px)]">
                How fast is your{" "}
                <span className="relative inline-block bg-gradient-to-r from-[#2F7BFF] to-[#22D3EE] bg-clip-text text-transparent after:absolute after:-bottom-1.5 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-gradient-to-r after:from-[#2F7BFF] after:to-[#22D3EE] after:content-['']">internet</span>{" "}right now?
              </h1>
              <p className="mt-3 max-w-[40ch] text-[16px] leading-relaxed text-[#B7C6E6] max-sm:hidden [@media(max-height:800px)]:lg:hidden">Measures download, upload and ping from this phone or laptop over your Wi-Fi.</p>
            </div>
            <ul className="flex w-full list-none flex-col items-start gap-2 p-0 max-lg:flex-row max-lg:items-stretch lg:max-w-[260px] [@media(max-height:800px)]:lg:max-w-none [@media(max-height:800px)]:lg:flex-row [@media(max-height:800px)]:lg:flex-wrap">
              <Pill Icon={Timer}>About 30 seconds</Pill><Pill Icon={Tag}>Free to use</Pill><Pill Icon={Laptop}>Phone or laptop</Pill>
            </ul>
            <div className="grid w-full gap-2 max-lg:max-w-[420px]">
              {conns.length > 0 && (
                <label className="grid gap-1 text-left text-[13px] font-semibold text-[#9FB3D9]">Save result to
                  <select value={conn} onChange={e => setConn(e.target.value)} className="h-10 rounded-xl border border-white/15 bg-[#0B1738] px-3 text-sm text-white">{conns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                </label>)}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 max-lg:justify-center">
                <ShimmerButton onClick={run} disabled={running} background="#1450E6" shimmerColor="#9CC3FF" borderRadius="16px" className="h-14 w-full text-[17px] disabled:opacity-70 lg:w-[250px]">
                  {running ? "Testing…" : done ? "Test again" : <>Test speed now <ArrowRight className="ml-2 size-5" aria-hidden="true" /></>}
                </ShimmerButton>
                {done && <button type="button" onClick={async () => (await getBridge()).report(last.current || {}, conn)} className="border-0 bg-transparent p-0 text-sm font-bold text-sky-300 underline underline-offset-4 hover:text-white">Report slow speed</button>}
              </div>
              {!user && <p className="text-[13px] text-[#8CA0C8] max-lg:hidden"><button type="button" data-act="login" className="border-0 bg-transparent p-0 font-bold text-sky-300 underline underline-offset-2">Log in</button> to save results and report slow speed.</p>}
            </div>
          </div>

          {/* centre: gauge */}
          <div ref={stage} className="relative scroll-mt-[76px] lg:order-2">
            <Card className={`relative items-center gap-3 overflow-hidden rounded-[28px] p-4 max-lg:p-4 lg:border-transparent lg:bg-transparent lg:p-0 lg:backdrop-blur-none ${glass}`}>
              <div role="button" tabIndex={0} aria-label="Tap the dial to start the speed test" onClick={run} onKeyDown={onDialKey}
                className="w-full max-w-[min(100%,max(300px,calc(100svh-390px)))] cursor-pointer rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 max-lg:max-w-[300px]">
                <Gauge value={live} running={running} done={done} />
              </div>
              <div className={`relative z-10 -mt-1 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[15px] font-bold transition-colors ${qCls}`} role="status" aria-live="polite">
                {done && <Check className="size-4" aria-hidden="true" />}{qLabel}
              </div>
              <ol className="relative z-10 mt-1 flex w-full max-w-[330px] list-none items-start justify-between p-0 lg:hidden" aria-label="Test steps">
                {["Ping", "Download", "Upload"].map((l, i) => { const n = i + 1, on = step === n, ok = step > n || step === 4; return (
                  <li key={l} className="relative flex flex-1 flex-col items-center gap-1 text-[13px] font-semibold text-[#C9D8FF]">
                    {i > 0 && <span className={`absolute right-1/2 top-3 h-px w-full ${ok || on ? "bg-emerald-400/60" : "bg-white/15"}`} aria-hidden="true" />}
                    <span className={`relative z-10 grid size-6 place-items-center rounded-full border text-[11px] ${ok ? "animate-[sp-pop_.35s_ease-out] border-emerald-400 bg-emerald-500 text-white" : on ? "animate-pulse border-sky-400 bg-sky-500/30" : "border-white/25 bg-[#0B1738]"}`}>{ok ? <Check className="size-3.5" /> : n}</span>{l}
                  </li>); })}
              </ol>
              {(running || done) && <BorderBeam size={140} duration={6} colorFrom="#3D7BFF" colorTo="#22D3EE" className="lg:hidden" />}
            </Card>
            <div aria-hidden="true" className="pointer-events-none mx-auto mt-1 hidden h-6 w-[78%] rounded-[50%] border border-cyan-300/40 bg-[radial-gradient(closest-side,rgba(34,211,238,.22),transparent)] shadow-[0_0_46px_rgba(34,211,238,.45)] lg:block" />
          </div>

          {/* right: stats */}
          <div className="grid grid-cols-2 gap-3 lg:order-3 lg:grid-cols-1 lg:gap-3">
            {stats.map(([label, Icon, v, unit, dp], i) => (
              <Card key={label} interactive className={`flex-row items-center gap-4 rounded-2xl px-4 py-3.5 max-lg:gap-3 max-lg:px-3 max-lg:py-3 ${glass} ${lift} ${v != null ? "animate-[sp-fade-up_.5s_ease-out_both]" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#17327A]/70 text-sky-200 max-lg:size-10"><Icon className="size-6 max-lg:size-5" aria-hidden="true" /></span>
                <div className="min-w-0"><p className="text-[13px] font-bold uppercase tracking-wider text-[#9FB3D9] max-lg:text-[12px]">{label}</p>
                  <p className="font-display text-[27px] font-extrabold leading-tight max-lg:text-[21px]">{v == null ? "–" : <NumberTicker value={v} decimalPlaces={dp} className="!tracking-normal" />} <span className="text-[17px] font-bold max-lg:text-[14px]">{unit}</span></p></div>
              </Card>))}
          </div>
        </div>

        {/* bottom: what can you do */}
        <Card className={`flex-row flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl px-6 py-3 max-lg:flex-col max-lg:items-stretch max-lg:px-4 ${glass}`}>
          <p className="font-display text-xl font-extrabold leading-tight lg:w-[190px]">What can you do at <span className="block text-[#2F9BFF]">{done ? `${Math.round(res.down)} Mbps?` : "your speed?"}</span></p>
          <ul className="grid flex-1 list-none grid-cols-4 gap-3 p-0 max-sm:grid-cols-2">
            {USES.map(u => { const s = fit(u, done ? res : null); return (
              <li key={u.k} className={`flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[.07] max-lg:flex-col max-lg:text-center max-lg:gap-1`}>
                <u.Icon className={`size-9 shrink-0 max-lg:size-7 ${s ? "text-sky-200" : "text-[#5F7AB0]"}`} aria-hidden="true" />
                <div><p className="text-[15px] font-bold leading-tight max-lg:text-[13px]">{u.k}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-[14px] font-bold max-lg:justify-center ${s ? fitCls[s] : "text-[#6F86B8]"}`}>{s ? <><Check className="size-4" aria-hidden="true" />{s}</> : "Run the test"}</p></div>
              </li>); })}
          </ul>
        </Card>
        {!user && <p className="text-center text-[13px] text-[#8CA0C8] lg:hidden"><button type="button" data-act="login" className="border-0 bg-transparent p-0 font-bold text-sky-300 underline underline-offset-2">Log in</button> to save results and report slow speed.</p>}
      </div>
      <SideArtRight />
      </div>
    </section>
  );
}
