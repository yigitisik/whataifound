// Typeset every formula in data/entries.json into data/math.json.
//
//     node scripts/build-math.mjs
//
// build.py runs this first whenever Node is installed. Entries write formulas as TeX
// between \( \) (inline) or \[ \] (display); this renders each one to MathML with the
// vendored Temml and writes the lot to data/math.json, which build-site.py and app.js
// both read. Rendering happens here, once, so neither the Python build nor the browser
// ever parses TeX: the page ships MathML the browser lays out natively.
//
// The output is committed like every other generated file. A build without Node reuses
// it, and fails, naming the entry, only when a formula is missing from it.
//
// A formula Temml cannot parse stops the build with the entry, field and source, rather
// than shipping a red error box on a published page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import temml from './vendor/temml.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Must match TEX in scripts/texmath.py and in js/app.js.
const TEX = /\\\((.+?)\\\)|\\\[(.+?)\\\]/gs;
const FIELDS = ['claim', 'detail', 'novelty_check', 'caveats'];

const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'entries.json'), 'utf8'));
const out = { inline: {}, display: {} };
const problems = [];

for (const e of entries){
  const texts = FIELDS.map(f => [f, e[f]]);
  (e.independent_checks || []).forEach((c, i) =>
    texts.push([`independent_checks[${i}].outcome`, c && c.outcome]));
  for (const [field, v] of texts){
    if (typeof v !== 'string') continue;
    for (const m of v.matchAll(TEX)){
      const display = m[1] === undefined;
      const tex = display ? m[2] : m[1];
      const kind = display ? 'display' : 'inline';
      if (tex in out[kind]) continue;
      try {
        // trust: false refuses \href, \class, \style and friends, so a formula can only
        // ever produce math, never a link or an attribute. annotate keeps the TeX source
        // inside the MathML, which is what copy-paste and a crawler recover.
        const mathml = temml.renderToString(tex, {
          displayMode: display, throwOnError: true, trust: false, annotate: true
        });
        // A display formula sits inside a <p>, so the wrapper is a span made a block in
        // styles.css; it scrolls a long formula sideways instead of widening the page.
        out[kind][tex] = display ? `<span class="math-block">${mathml}</span>` : mathml;
      } catch (err){
        problems.push(`${e.id}: ${field}: ${m[0]}: ${err.message.trim()}`);
      }
    }
  }
}

if (problems.length){
  console.error(`data/entries.json has ${problems.length} formula(s) that do not parse:\n  - `
                + problems.join('\n  - '));
  process.exit(1);
}

// Sorted keys, one formula per line: deterministic bytes, and a diff that names the
// formula that changed.
const sorted = kind => Object.fromEntries(Object.keys(out[kind]).sort().map(k => [k, out[kind][k]]));
const body = JSON.stringify({ inline: sorted('inline'), display: sorted('display') }, null, 1);
fs.writeFileSync(path.join(ROOT, 'data', 'math.json'), body + '\n');
console.log(`Typeset ${Object.keys(out.inline).length} inline and `
            + `${Object.keys(out.display).length} display formula(s) into data/math.json`);
