/* PostToolUse hook (Edit|Write): runs ESLint on the one frontend file Claude just changed.
   Exit 2 sends the lint errors back to Claude so it fixes them in the same turn. Silent when clean. */
const { spawnSync } = require("child_process");
const path = require("path");
let raw = "";
process.stdin.on("data", d => (raw += d));
process.stdin.on("end", () => {
  let file = "";
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ""; } catch (e) { process.exit(0); }
  const f = file.replace(/\\/g, "/");
  const m = /^(.*\/frontend)\/src\/.+\.(jsx?|mjs)$/.exec(f);
  if (!m || /\/lib\/i18n\/hi-(?!extra)/.test(f)) process.exit(0);   // not frontend code, or a big Hindi list
  const r = spawnSync("npx", ["eslint", "--no-warn-ignored", path.relative(m[1], f)], { cwd: m[1], encoding: "utf8", shell: true, timeout: 55000 });
  if (r.status && r.status !== 0) {
    process.stderr.write(`ESLint found problems in ${path.basename(f)}. Fix them:\n${(r.stdout || "") + (r.stderr || "")}`.slice(0, 3000));
    process.exit(2);
  }
  process.exit(0);
});
