// Applies dsh-desktop's local patches to the bundled dsh copy.
// Idempotent; run after `npm run sync-dsh` (which purges dsh-bundle).
//
// Patch 1: dsh-subprocess-local spawns console programs (bash/git/...)
// without windowsHide, so every bash tool call flashes a console window
// on Windows. Add `windowsHide: true` to that spawn.
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  __dirname,
  "dsh-bundle",
  "node_modules",
  "@deepseek-ai",
  "dsh-subprocess-local",
  "lib",
  "index.js"
);

const ANCHOR = '\t\tdetached: platform !== "win32"\n\t});';
const PATCHED =
  '\t\tdetached: platform !== "win32",\n' +
  "\t\twindowsHide: true // dsh-desktop patch: don't flash a console window per command\n" +
  "\t});";

const src = fs.readFileSync(target, "utf8");
if (src.includes("windowsHide: true // dsh-desktop patch")) {
  console.log("patch-dsh: already applied");
} else if (src.includes(ANCHOR)) {
  fs.writeFileSync(target, src.replace(ANCHOR, PATCHED));
  console.log("patch-dsh: applied windowsHide patch");
} else {
  console.error("patch-dsh: anchor not found — dsh internals changed, patch needs review");
  process.exit(1);
}
