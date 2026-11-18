/* Server-rendered h1 and intro text for pages whose visible content is painted by JavaScript into <main id="app"> (/ and /care).
   Crawlers and AI tools that do not run JS read it. It is visually hidden at first, and ViewRoute hides it for good once the
   painted view (which has its own h1) is on screen, so the page keeps one h1. */
const VISUALLY_HIDDEN = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

export default function SeoIntro({ title, children }) {
  return (
    <div data-seo-intro="" style={VISUALLY_HIDDEN}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
