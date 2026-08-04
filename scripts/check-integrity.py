#!/usr/bin/env python3
"""Check that the deployed files contain nothing a contributor could have smuggled in.

    python3 scripts/check-integrity.py

Why this is separate from build.py
----------------------------------
build.py regenerates the site and CI fails on any diff, which catches a stale build.
That is not the same as catching a *malicious* one. Two gaps it does not close:

1. Roughly a quarter of index.html (the <head>, the JSON-LD block, the nav, the
   footer, the script tags) sits outside the <!--…:START/END--> markers and is never
   regenerated. A payload placed there survives every rebuild untouched, so `git diff`
   after a rebuild is clean and CI is satisfied.

2. Generated output is committed, so a PR's diff contains tens of thousands of lines
   of machine-written HTML. A reviewer skimming that is exactly who a smuggled
   <script> is aimed at.

So this asserts properties of the *content*, independent of whether it was generated:
no unexpected inline scripts, no external script/frame origins outside the CSP, no
javascript:/data: links, and no stray markup in the registry data. It is cheap, has no
dependencies, and is meant to run on every PR alongside the rebuild.

It also enforces one house-style rule, for the same reason: prose is written by hand in
a dozen places and a rule nobody can forget is worth more than a rule everybody knows.

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

DEPLOYED_HTML = ["index.html", "methodology.html", "visuals.html", "review.html",
                 "contributors.html", "account.html", "privacy.html",
                 "contribute.html", "admin.html", "404.html"]

# Directories the em dash sweep never descends into: version control, build caches, and
# anything a local tool dropped in. All are either untracked or not prose.
STYLE_SKIP_DIRS = {".git", "__pycache__", "node_modules", ".vercel", ".vscode", ".idea",
                   ".cache", "tmp"}
# Written as an escape, not as the character: this file is swept like every other, and a
# literal here would make the check fail on itself.
EM_DASH = "\u2014"


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


def text_files():
    """Every UTF-8 text file in the repository, as (relative path, contents).

    Shared by the two whole-tree style sweeps below so the walk happens once. Binary
    files are skipped by failing to decode rather than by extension, so adding a new
    asset type never means editing a list here.
    """
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in STYLE_SKIP_DIRS)
        for name in sorted(filenames):
            path = os.path.join(dirpath, name)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            yield os.path.relpath(path, ROOT), text


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def check_html(path, problems):
    rel = os.path.relpath(path, ROOT)
    src = open(path).read()

    for m in re.finditer(r"<script\b([^>]*)>(.*?)</script>", src, re.S | re.I):
        attrs, body = m.group(1), m.group(2)
        line = line_of(src, m.start())
        # A ld+json block is data, not code: the browser never executes it. Confirm it
        # really is JSON (so nothing is hiding in a mislabelled block) and move on.
        if re.search(r'type\s*=\s*["\']application/ld\+json["\']', attrs, re.I):
            try:
                json.loads(body)
            except ValueError as exc:
                problems.append(f"{rel}:{line}: ld+json block is not valid JSON ({exc})")
            if re.search(r"</\s*script", body, re.I):
                problems.append(f"{rel}:{line}: ld+json block contains '</script'. "
                                "it would terminate the block and inject markup")
            continue
        ext = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs, re.I)
        if ext:
            url = ext.group(1)
            # Same-origin ("/js/app.js", "x.js") is fine; anything else must be allowlisted.
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

    for tag in ("<object", "<embed", "<base"):
        for m in re.finditer(re.escape(tag) + r"\b", src, re.I):
            problems.append(f"{rel}:{line_of(src, m.start())}: unexpected {tag}> element")

    # <form> was rejected outright until the account page needed one. A real form is
    # meaningfully better than a div for keyboard and screen reader users, so the rule
    # is narrowed rather than dropped: a form may exist, but not carry an `action`.
    # Without one it can only submit to the current URL, and the CSP's `form-action
    # 'self'` is the second lock. An action= would be a way to post a reader's input to
    # another origin from a page that looks like ours.
    for m in re.finditer(r"<form\b([^>]*)>", src, re.I):
        if re.search(r"\baction\s*=", m.group(1), re.I):
            problems.append(f"{rel}:{line_of(src, m.start())}: <form> carries an action "
                            "attribute. Forms here submit through fetch to /api/ on the "
                            "same origin; an action= can post a reader's input off-site")


def check_data(problems):
    """The registry itself: URLs are re-checked here so the data is safe on its own.

    build-site.py validates on the way in; this validates what is committed, which is
    the artifact a reviewer is actually approving.
    """
    path = os.path.join(ROOT, "data", "entries.json")
    entries = json.load(open(path))
    for e in entries:
        eid = e.get("id", "?")
        for field in ("sources", "discussion", "independent_checks", "revisions"):
            for item in (e.get(field) or []):
                if not isinstance(item, dict):
                    continue
                url = item.get("url")
                if field in ("independent_checks", "revisions") and not url:
                    continue
                if not isinstance(url, str) or not url.startswith(("https://", "http://")):
                    problems.append(f"data/entries.json: {eid}: {field} URL {url!r} "
                                    "is not an http(s) link")
        # Entry text is escaped at render time, so markup here is not an injection,
        # but it is a sign of a copy-paste that should be read before it is merged.
        for field in ("title", "claim", "detail", "novelty_check", "caveats"):
            v = e.get(field)
            if isinstance(v, str) and re.search(r"<\s*(script|iframe|img|svg|object|embed)\b", v, re.I):
                problems.append(f"data/entries.json: {eid}: {field} contains raw markup "
                                f"({v[:60]!r}). Review before merging")


def check_em_dashes(problems):
    """No em dash (U+2014) anywhere in the repository.

    House style for the site's written voice, and the kind of rule that only holds if
    something checks it: prose lives in the docs, in `index.html`'s hand-written
    sections, in code comments, and in the strings build-site.py writes into the
    generated pages. One sweep covers all four.

    En dashes (U+2013) are deliberately *not* covered. The registry is full of
    legitimate ones and a blanket sweep would corrupt its content: proper nouns
    (Navier-Stokes, Dinitz-Garg-Goemans), numeric ranges (2000-2022) and compound
    modifiers (protein-ligand) all use them correctly.

    Binary files are skipped by failing to decode as UTF-8 rather than by extension, so
    adding a new asset type never means editing this list.
    """
    for rel, text in text_files():
        if EM_DASH not in text:
            continue
        for n, line in enumerate(text.split("\n"), 1):
            col = line.find(EM_DASH)
            if col < 0:
                continue
            context = line[max(0, col - 32):col + 33].strip()
            problems.append(
                f"{rel}:{n}: em dash (U+2014) in {context!r}. Use a colon, comma, "
                "semicolon or parentheses, whichever the sentence wants.")


def check_control_chars(problems):
    """No literal control character in a text file.

    These are legal in a JavaScript string or regex and run correctly, which is exactly
    the problem: `api/_lib/names.js` carried a real NUL byte inside its UNSAFE character
    class for two phases and every test passed. What it broke was everything that reads
    the file as text. grep classifies a file containing NUL as binary and silently prints
    nothing, so a search for a symbol in that file returns no hits and reads as "unused";
    diffs and code review hide the byte entirely.

    Written as an escape (\\u0000) the behaviour is identical and the intent is legible.
    Tab, newline and carriage return are excluded because they are ordinary text.
    """
    # DEL plus the C0 range, minus the three whitespace characters that belong in a file.
    offenders = {chr(c) for c in range(32)} - {"\t", "\n", "\r"} | {"\x7f"}
    for rel, text in text_files():
        if not offenders.intersection(text):
            continue
        for n, line in enumerate(text.split("\n"), 1):
            for col, ch in enumerate(line):
                if ch not in offenders:
                    continue
                context = line[max(0, col - 32):col + 33].strip()
                problems.append(
                    f"{rel}:{n}: literal control character U+{ord(ch):04X} in {context!r}. "
                    f"Write it as an escape (\\u{ord(ch):04x}) instead: a NUL byte makes "
                    "grep treat the whole file as binary.")
                break   # one report per line is enough to find it


def main():
    problems = []
    for path in html_files():
        check_html(path, problems)
    check_data(problems)
    check_em_dashes(problems)
    check_control_chars(problems)

    if problems:
        print(f"Integrity check failed with {len(problems)} problem(s):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(1)
    print("Integrity check passed: no unexpected scripts, origins, handlers, URL schemes, "
          "em dashes or control characters.")


if __name__ == "__main__":
    main()
