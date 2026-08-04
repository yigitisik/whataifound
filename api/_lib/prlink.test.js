// account.js renders a pull request link into an href. esc() stops a value breaking out
// of the attribute, but an escaped `javascript:alert(1)` in an href still runs on click,
// so the scheme and host are checked at the point of use.
//
// prLink() lives in account.js, which is a browser script with no exports. Rather than
// restructure a 200-line file for a test, the function is lifted out of the source and
// evaluated here: if it is edited, this test sees the edit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "js", "account.js"), "utf8");

const slice = SRC.match(/const PR_PREFIX = [\s\S]*?\n  }\n/);
assert.ok(slice, "could not find prLink() in account.js; has it been renamed?");
const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const prLink = new Function("esc", `${slice[0]}; return prLink;`)(esc);

test("a real pull request URL renders a link", () => {
  const out = prLink({ prUrl: "https://github.com/yigitisik/whataifound/pull/128", prNumber: 128 });
  assert.match(out, /^<a class="feed-src" href="https:\/\/github\.com\/yigitisik\/whataifound\/pull\/128"/);
  assert.match(out, /rel="noopener"/);
  assert.match(out, /PR #128/);
});

test("executable schemes render nothing", () => {
  // The finding this fixes. Each of these survives esc() intact and would run on click.
  const hostile = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ];
  for (const prUrl of hostile) {
    assert.equal(prLink({ prUrl, prNumber: 1 }), "", JSON.stringify(prUrl));
  }
});

test("other hosts render nothing, including lookalikes", () => {
  const hostile = [
    "https://evil.example/yigitisik/whataifound/pull/1",
    "https://github.com.evil.example/yigitisik/whataifound/pull/1",
    "https://github.com@evil.example/yigitisik/whataifound/pull/1",
    "http://github.com/yigitisik/whataifound/pull/1",     // downgraded scheme
    "https://github.com/someone-else/repo/pull/1",
    "https://gist.github.com/yigitisik/whataifound/pull/1",
  ];
  for (const prUrl of hostile) {
    assert.equal(prLink({ prUrl, prNumber: 1 }), "", prUrl);
  }
});

test("a path that walks out of the prefix renders nothing", () => {
  // Passes a naive startsWith, which is why the origin is parsed as well.
  const out = prLink({
    prUrl: "https://github.com/yigitisik/whataifound/pull/../../../evil", prNumber: 1,
  });
  assert.doesNotMatch(out, /evil/);
});

test("a missing or malformed URL renders nothing rather than throwing", () => {
  for (const prUrl of [undefined, null, "", "not a url", 42, {}, []]) {
    assert.equal(prLink({ prUrl, prNumber: 1 }), "", JSON.stringify(prUrl));
  }
});

test("the PR number is escaped", () => {
  const out = prLink({
    prUrl: "https://github.com/yigitisik/whataifound/pull/1",
    prNumber: '1"><img src=x onerror=alert(1)>',
  });
  assert.doesNotMatch(out, /<img/, "must not emit raw markup");
  assert.match(out, /&quot;|&lt;/);
});
