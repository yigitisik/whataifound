#!/usr/bin/env python3
"""Check that the pre-rendered markup in index.html matches what app.js produces.

Two renderers in build-site.py are hand-ports of functions in app.js:

    card()        the entry cards. If these drift, the DOM visibly changes the moment
                  app.js re-renders (any search or filter), which is exactly the bug
                  pre-rendering was meant to avoid.
    matrix_card() the evidence/autonomy chart in the homepage hero. app.js owns the copy
                  visuals.html mounts; a drift shows as two different charts of the same
                  data on two pages of the same site.

This runs the real app.js functions under Node against the real data and diffs them
against what build-site.py wrote.

    python3 scripts/verify-parity.py

Requires Node. Exits non-zero on any mismatch, so it can gate CI.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# app.js is a browser script: it touches matchMedia, localStorage and the DOM at load.
# Rather than emulate a DOM, take just the pure rendering regions and evaluate those in
# isolation. Each slice runs from a declaration to the start of the next thing that needs
# a browser, so the cut points are function boundaries rather than line numbers.
src = open(os.path.join(ROOT, "app.js")).read()


def region(start, end):
    """The source between two markers, both of which must appear exactly once."""
    for marker in (start, end):
        if src.count(marker) != 1:
            sys.exit(f"verify-parity: {marker!r} appears {src.count(marker)} times in "
                     f"app.js; this script slices on it and needs exactly one.")
    return src[src.index(start):src.index(end)]


# Label tables, esc(), and card(), up to the first browser-dependent code.
head = src[:src.index("// Sitemap rail")]
# Drop the two IIFEs / statements that need browser globals.
head = head.replace("const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;",
                    "const REDUCE = false;")
head = re.sub(r"// Theme: light / dark / system.*?\n\}\)\(\);\n", "", head, flags=re.S)
# matrixCard() and the colour table it reads. Both sit past the cut above.
head += region("const AUT_COLOR", "function scatterCard")
head += region("function matrixCard", "function wireScatterTip")
# tableView() reads STATE.sort for the active-column marker, so the state block comes
# with it. Nothing in either slice is called at load, so the parts that would need a
# browser (readState reading location, SORTS calling score) are never reached.
head += region("const PARAMS =", "// ---------- Search ----------")
head += region("// ---------- Table view ----------", "function render(){")

entries = json.load(open(os.path.join(ROOT, "data", "entries.json")))
entries.sort(key=lambda e: e.get("date", ""), reverse=True)

page = open(os.path.join(ROOT, "index.html")).read()


def rendered(start, end):
    """What build-site.py wrote between a pair of markers."""
    i = page.index(start) + len(start)
    return page[i:page.index(end)].strip("\n")


# One Node process for both checks. Each writes to stdout with a sentinel between them,
# so a failure in either is reported against the right renderer.
SPLIT = "@@PARITY-SPLIT@@"
script = (head + "\nconst DATA = " + json.dumps(entries) + ";\n"
          + "ALL = DATA;\n"
          + "process.stdout.write(DATA.map(card).join('\\n') + " + json.dumps(SPLIT)
          + " + matrixCard() + " + json.dumps(SPLIT) + " + tableView(DATA));\n")

# Delivered on stdin rather than as `node -e <script>`: the script embeds the whole
# registry, and Linux caps a single argv entry at 128 KiB (MAX_ARG_STRLEN) regardless of
# the much larger total ARG_MAX. macOS has no per-argument cap, so `-e` passed locally
# and failed only in CI once data/entries.json grew past 128 KiB.
try:
    js = subprocess.run(["node", "-"], input=script, capture_output=True, text=True,
                        check=True).stdout
except FileNotFoundError:
    sys.exit("verify-parity: node not found; install Node to run this check.")
except subprocess.CalledProcessError as exc:
    sys.exit(f"verify-parity: app.js failed to run:\n{exc.stderr}")

js_cards, js_matrix, js_table = js.split(SPLIT)

checks = [
    ("cards", rendered("<!--ENTRIES:START-->", "<!--ENTRIES:END-->"), js_cards,
     f"{len(entries)} pre-rendered cards match app.js card() exactly"),
    ("matrix", rendered("<!--MATRIX:START-->", "<!--MATRIX:END-->"), js_matrix,
     "pre-rendered hero matrix matches app.js matrixCard() exactly"),
    ("table", rendered("<!--TABLE:START-->", "<!--TABLE:END-->"), js_table,
     f"pre-rendered table of {len(entries)} findings matches app.js tableView() exactly"),
]

failed = False
for name, built, want, ok_msg in checks:
    if built == want:
        print(f"parity OK: {ok_msg}.")
        continue
    failed = True
    # Report the first difference rather than dumping ~60KB of diff.
    b, a = built.split("\n"), want.split("\n")
    for n, (x, y) in enumerate(zip(b, a), 1):
        if x != y:
            col = next((i for i, (p, q) in enumerate(zip(x, y)) if p != q), min(len(x), len(y)))
            print(f"MISMATCH ({name}) at line {n}, col {col}:\n"
                  f"  build-site.py: {x[max(0, col - 40):col + 180]}\n"
                  f"  app.js       : {y[max(0, col - 40):col + 180]}")
            break
    else:
        print(f"MISMATCH ({name}) in length: build-site.py {len(b)} lines, "
              f"app.js {len(a)} lines.")

sys.exit(1 if failed else 0)
