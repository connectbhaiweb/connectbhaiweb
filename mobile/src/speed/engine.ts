/* The speed test measures with the same Cloudflare module, version and measurement plan as the website
   (frontend/src/components/speed/SpeedTest.jsx). The module needs a browser, so it runs in a hidden WebView
   that sends its readings back to the native screen. */
export const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@cloudflare/speedtest@1.3.0/+esm';

export const PLAN = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 8 },
  { type: 'download', bytes: 1e6, count: 8 },
  { type: 'upload', bytes: 1e5, count: 8 },
  { type: 'upload', bytes: 1e6, count: 6 },
  { type: 'download', bytes: 1e7, count: 6 },
  { type: 'upload', bytes: 1e7, count: 4 },
  { type: 'download', bytes: 2.5e7, count: 4 },
];

export type SpeedEvent =
  | { type: 'phase'; phase: 'ping' | 'download' | 'upload'; value: number | null }
  | { type: 'done'; down: number; up: number; ping: number; jitter: number }
  | { type: 'error'; reason: 'load' | 'run' };

export const speedPage = () => `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">
const send = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
try {
  const m = await import(${JSON.stringify(MODULE_URL)});
  const SpeedTest = m.default || m.SpeedTest;
  const test = new SpeedTest({ autoStart: false, measurements: ${JSON.stringify(PLAN)} });
  test.onResultsChange = ({ type }) => {
    const r = test.results;
    if (type === 'download') { const d = r.getDownloadBandwidth(); send({ type: 'phase', phase: 'download', value: d ? d / 1e6 : null }); }
    else if (type === 'upload') { const u = r.getUploadBandwidth(); send({ type: 'phase', phase: 'upload', value: u ? u / 1e6 : null }); }
    else if (type === 'latency') { send({ type: 'phase', phase: 'ping', value: r.getUnloadedLatency() || null }); }
  };
  test.onFinish = (r) => { const x = r.getSummary(); send({ type: 'done', down: x.download / 1e6, up: x.upload / 1e6, ping: x.latency, jitter: x.jitter }); };
  test.onError = () => send({ type: 'error', reason: 'run' });
  test.play();
} catch (e) { send({ type: 'error', reason: 'load' }); }
</script></body></html>`;

export function parseSpeedEvent(data: string): SpeedEvent | null {
  try {
    const message = JSON.parse(data);
    return message && ['phase', 'done', 'error'].includes(message.type) ? (message as SpeedEvent) : null;
  } catch {
    return null;
  }
}
