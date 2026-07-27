#!/usr/bin/env python3
"""Check that the deployed files contain nothing a contributor could have smuggled in.

    python3 scripts/check-integrity.py

Why this is separate from build.py
----------------------------------
build.py regenerates the site and CI fails on any diff, which catches a stale build.
That is not the same as catching a *malicious* one. Two gaps it does not close:

1. Roughly a quarter of index.html — the <head>, the JSON-LD block, the nav, the
   footer, the script tags — sits outside the <!--…:START/END--> markers and is never
   regenerated. A payload placed there survives every rebuild untouched, so `git diff`
   after a rebuild is clean and CI is satisfied.

2. Generated output is committed, so a PR's diff contains tens of thousands of lines
   of machine-written HTML. A reviewer skimming that is exactly who a smuggled
   <script> is aimed at.

So this asserts properties of the *content*, independent of whether it was generated:
no unexpected inline scripts, no external script/frame origins outside the CSP, no
javascript:/data: links, and no stray markup in the registry data. It is cheap, has no
dependencies, and is meant to run on every PR alongside the rebuild.

Exits non-zero and names the file and line on any violation.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The only inline <script> blocks the site is supposed to contain. Anything else in a
# deployed HTML file is a finding, not a style preference. Matched as substrings against
# the script body, so incidental whitespace differences do not trip it.
ALLOWED_INLINE = (
    "localStorage.getItem('theme')",          # pre-paint theme initialiser
    "window.va=window.va||function()",        # Vercel Web Analytics shim
    "window.si=window.si||function()",        # Vercel Speed Insights shim
)
# Origins the CSP in vercel.json already permits for scripts and frames.
ALLOWED_SRC_HOSTS = ("https://va.vercel-scripts.com",)
ALLOWED_FRAME_HOSTS = ("https://www.youtube-nocookie.com", "https://www.youtube.com")

DEPLOYED_HTML = ["index.html", "methodology.html", "visuals.html", "404.html"]


def html_files():
    for name in DEPLOYED_HTML:
        p = os.path.join(ROOT, name)
        if os.path.exists(p):
            yield p
    fdir = os.path.join(ROOT, "finding")
    if os.path.isdir(fdir):
        for name in sorted(os.listdir(fdir)):
            if name.endswith(".html"):
                yield os.path.join(fdir, name)


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def check_html(path, problems):
    rel = os.path.relpath(path, ROOT)
    src = open(path).read()

    for m in re.finditer(r"<script\b([^>]*)>(.*?)</script>", src, re.S | re.I):
        attrs, body = m.group(1), m.group(2)
        line = line_of(src, m.start())
        # A ld+json block is data, not code — the browser never executes it. Confirm it
        # really is JSON (so nothing is hiding in a mislabelled block) and move on.
        if re.search(r'type\s*=\s*["\']application/ld\+json["\']', attrs, re.I):
            try:
                json.loads(body)
            except ValueError as exc:
                problems.append(f"{rel}:{line}: ld+json block is not valid JSON ({exc})")
            if re.search(r"</\s*script", body, re.I):
                problems.append(f"{rel}:{line}: ld+json block contains '</script' — "
                                "it would terminate the block and inject markup")
            continue
        ext = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs, re.I)
        if ext:
            url = ext.group(1)
            # Same-origin ("/x.js", "app.js") is fine; anything else must be allowlisted.
            if re.match(r"^(?:[a-z]+:)?//", url, re.I) and not url.startswith(ALLOWED_SRC_HOSTS):
                problems.append(f"{rel}:{line}: external script src {url!r} is not in the CSP allowlist")
        elif body.strip() and not any(a in body for a in ALLOWED_INLINE):
            snippet = " ".join(body.split())[:90]
            problems.append(f"{rel}:{line}: unexpected inline <script>: {snippet!r}")

    for m in re.finditer(r'\b(?:href|src|action|formaction)\s*=\s*["\']\s*'
                         r'(javascript:|data:(?!image/)|vbscript:)', src, re.I):
        problems.append(f"{rel}:{line_of(src, m.start())}: "
                        f"executable URL scheme {m.group(1)!r} in an attribute")

    # Inline event handlers (onclick=, onerror=, onload=…). The site attaches all of
    # its listeners from app.js, so any of these in shipped markup is smuggled in.
    for m in re.finditer(r"<[^>]*?\son([a-z]+)\s*=", src, re.I):
        problems.append(f"{rel}:{line_of(src, m.start())}: inline event handler "
                        f"'on{m.group(1)}' in markup")

    for m in re.finditer(r"<iframe\b[^>]*\bsrc\s*=\s*[\"']([^\"']+)", src, re.I):
        url = m.group(1)
        if re.match(r"^(?:[a-z]+:)?//", url, re.I) and not url.startswith(ALLOWED_FRAME_HOSTS):
            problems.append(f"{rel}:{line_of(src, m.start())}: iframe src {url!r} "
                            "is not an allowed frame origin")

    for tag in ("<object", "<embed", "<base", "<form"):
        for m in re.finditer(re.escape(tag) + r"\b", src, re.I):
            problems.append(f"{rel}:{line_of(src, m.start())}: unexpected {tag}> element")


def check_data(problems):
    """The registry itself: URLs are re-checked here so the data is safe on its own.

    build-site.py validates on the way in; this validates what is committed, which is
    the artifact a reviewer is actually approving.
    """
    path = os.path.join(ROOT, "data", "entries.json")
    entries = json.load(open(path))
    for e in entries:
        eid = e.get("id", "?")
        for field in ("sources", "discussion", "independent_checks"):
            for item in (e.get(field) or []):
                url = item.get("url")
                if field == "independent_checks" and not url:
                    continue
                if not isinstance(url, str) or not url.startswith(("https://", "http://")):
                    problems.append(f"data/entries.json: {eid}: {field} URL {url!r} "
                                    "is not an http(s) link")
        # Entry text is escaped at render time, so markup here is not an injection —
        # but it is a sign of a copy-paste that should be read before it is merged.
        for field in ("title", "claim", "detail", "novelty_check", "caveats"):
            v = e.get(field)
            if isinstance(v, str) and re.search(r"<\s*(script|iframe|img|svg|object|embed)\b", v, re.I):
                problems.append(f"data/entries.json: {eid}: {field} contains raw markup "
                                f"({v[:60]!r}) — review before merging")


def main():
    problems = []
    for path in html_files():
        check_html(path, problems)
    check_data(problems)

    if problems:
        print(f"Integrity check failed with {len(problems)} problem(s):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(1)
    print("Integrity check passed: no unexpected scripts, origins, handlers or URL schemes.")


if __name__ == "__main__":
    main()
