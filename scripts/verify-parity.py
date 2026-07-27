#!/usr/bin/env python3
"""Check that the pre-rendered cards in index.html match what app.js's card() produces.

build-site.py's card() is a hand-port of card() in app.js. If the two drift, the DOM
visibly changes the moment app.js re-renders (any search or filter), which is exactly
the bug pre-rendering was meant to avoid. This runs the real app.js card() under Node
against the real data and diffs it against what build-site.py wrote.

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
# Rather than emulate a DOM, take just the pure card()-rendering region (everything
# from the label tables down to the end of card()) and evaluate that in isolation.
src = open(os.path.join(ROOT, "app.js")).read()
end = src.index("// Sitemap rail")
head = src[:end]
# Drop the two IIFEs / statements that need browser globals.
head = head.replace("const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;",
                    "const REDUCE = false;")
head = re.sub(r"// Theme: light / dark / system.*?\n\}\)\(\);\n", "", head, flags=re.S)

entries = json.load(open(os.path.join(ROOT, "data", "entries.json")))
entries.sort(key=lambda e: e.get("date", ""), reverse=True)

script = head + "\nconst DATA = " + json.dumps(entries) + ";\n" \
         "process.stdout.write(DATA.map(card).join('\\n'));\n"

try:
    js = subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True).stdout
except FileNotFoundError:
    sys.exit("verify-parity: node not found; install Node to run this check.")
except subprocess.CalledProcessError as exc:
    sys.exit(f"verify-parity: app.js card() failed to run:\n{exc.stderr}")

page = open(os.path.join(ROOT, "index.html")).read()
i = page.index("<!--ENTRIES:START-->") + len("<!--ENTRIES:START-->")
j = page.index("<!--ENTRIES:END-->")
built = page[i:j].strip("\n")

if built == js:
    print(f"parity OK: {len(entries)} pre-rendered cards match app.js card() exactly.")
    sys.exit(0)

# Report the first differing entry rather than dumping ~60KB of diff.
b, a = built.split("\n"), js.split("\n")
for n, (x, y) in enumerate(zip(b, a), 1):
    if x != y:
        print(f"MISMATCH at line {n}:\n  build-site.py: {x[:220]}\n  app.js       : {y[:220]}")
        break
else:
    print(f"MISMATCH in length: build-site.py {len(b)} lines, app.js {len(a)} lines.")
sys.exit(1)
