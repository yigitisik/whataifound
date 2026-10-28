// Generate the served scripts in js/ from their sources: js/<name>.src.js -> js/<name>.js.
//
//     node scripts/build-js.mjs            # write them
//     node scripts/build-js.mjs --check    # fail if any is stale
//
// The .src.js files are the ones to edit. They are commented, and build-site.py,
// verify-parity.py and the API tests read them. Most of their bytes are those comments,
// which no browser needs, so every page links the minified copy written here. The copy
// keeps the served name, so no page or template has to know the difference.
//
// This is the same arrangement as styles.src.css and build-css.py, with one difference:
// minifying JavaScript safely takes a real parser, so this uses terser, pinned in
// package.json's devDependencies. Like build-math.mjs, it is optional locally. Without
// Node or without `npm ci`, build.py reuses the committed copies, and CI (which installs
// both) fails on the drift if a source changed without them being rebuilt.
//
// Settings, and why:
//   compress + mangle   the bulk of the saving. Top-level names are not mangled
//                       (terser's default), because the page scripts are classic
//                       scripts sharing one global scope: chrome.js defines esc() and
//                       show() for the others.
//   ascii_only          check-integrity.py forbids literal em dashes and control
//                       characters anywhere in the repository. Sources write them as
//                       \u escapes, and this keeps terser from turning them back.
//   semicolons: false   a newline wherever a semicolon would go. The same size after
//                       compression, but a diff of the output shows lines, not one line.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const JS = join(ROOT, "js");
const CHECK = process.argv.includes("--check");

let minify;
try {
  ({ minify } = await import("terser"));
} catch {
  console.log("terser is not installed (run `npm ci`); reusing the committed js/*.js");
  process.exit(0);
}

const OPTIONS = {
  compress: true,
  mangle: true,
  format: { ascii_only: true, semicolons: false },
};

const stale = [];
for (const name of readdirSync(JS).filter(n => n.endsWith(".src.js")).sort()) {
  const out = name.replace(/\.src\.js$/, ".js");
  const src = readFileSync(join(JS, name), "utf8");
  let code;
  try {
    ({ code } = await minify(src, OPTIONS));
  } catch (err) {
    console.error(`js/${name}: ${err.message} (line ${err.line}, col ${err.col})`);
    process.exit(1);
  }
  const text = `// Generated from js/${name} by scripts/build-js.mjs. Edit that, then run scripts/build.py.\n${code}\n`;
  if (CHECK) {
    let current = null;
    try { current = readFileSync(join(JS, out), "utf8"); } catch {}
    if (current !== text) stale.push(`js/${out}`);
    continue;
  }
  writeFileSync(join(JS, out), text);
  console.log(`Wrote js/${out}: ${src.length.toLocaleString("en")} -> ${text.length.toLocaleString("en")} bytes`);
}
if (CHECK) {
  if (stale.length) {
    console.error(`Stale or hand-edited: ${stale.join(", ")}. Edit the .src.js, run 'python3 scripts/build.py' and commit the result.`);
    process.exit(1);
  }
  console.log("js/*.js are current.");
}
