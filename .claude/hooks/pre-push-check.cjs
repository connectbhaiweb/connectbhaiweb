/* PreToolUse hook (Bash): before any `git push`, runs the frontend lint, and the backend typecheck when backend files
   changed. Exit 2 blocks the push and tells Claude why. Other commands pass straight through. */
const { spawnSync } = require("child_process");
const path = require("path");
let raw = "";
process.stdin.on("data", d => (raw += d));
process.stdin.on("end", () => {
  let cmd = "";
  try { cmd = (JSON.parse(raw).tool_input || {}).command || ""; } catch (e) { process.exit(0); }
  if (!/\bgit\s+(?:-C\s+\S+\s+)?push\b/.test(cmd)) process.exit(0);
  const repo = path.resolve(__dirname, "..", "..");
  const run = (args, cwd) => spawnSync("npm", args, { cwd, encoding: "utf8", shell: true, timeout: 150000 });
  const fail = (what, r) => { process.stderr.write(`Push blocked: ${what} failed. Fix it, then push again.\n${(r.stdout || "") + (r.stderr || "")}`.slice(0, 3000)); process.exit(2); };
  const lint = run(["run", "lint"], path.join(repo, "frontend"));
  if (lint.status !== 0) fail("frontend lint", lint);
  const diff = spawnSync("git", ["diff", "--name-only", "origin/staging..HEAD"], { cwd: repo, encoding: "utf8", shell: true });   // only what the push sends
  const client = path.join(repo, "backend", "node_modules", ".prisma", "client", "index.d.ts");
  const generated = require("fs").existsSync(client) && require("fs").readFileSync(client, "utf8").includes("PlanType");
  if (/^backend\/.*\.ts$/m.test(diff.stdout || "") && generated) {   // without `npm run db:generate` the typecheck fails for reasons unrelated to the change
    const tc = run(["run", "typecheck"], path.join(repo, "backend"));
    if (tc.status !== 0) fail("backend typecheck", tc);
  }
  process.exit(0);
});
