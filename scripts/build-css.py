#!/usr/bin/env python3
"""Generate styles.css, the stylesheet every page links, from styles.src.css.

styles.src.css is the one to edit: commented, indented, and read by build-site.py (the
vocabulary pill colours) and check-mobile.py (touch sizing), which report problems by
its line numbers. Most of its bytes are those comments, which no browser needs, so the
served styles.css is a minified copy written here. Keeping the served name means no
page, template or function has to know the difference.

    python3 scripts/build-css.py            # write it
    python3 scripts/build-css.py --check    # fail if it is stale

Run from build.py, so the copy cannot fall behind the source, and committed like every
other generated file, so CI's rebuild catches both a source edit that was not rebuilt
and a hand-edit to styles.css itself.

The output keeps one rule per line rather than one line for the whole file: it costs
about a kilobyte before compression and almost nothing after, and in exchange a diff of
styles.css shows which rules moved instead of a single changed line.

The minifier is deliberately conservative and dependency-free (Python is the only hard
requirement of the build). It only removes what cannot change meaning: comments, and
whitespace next to punctuation that never needs it. It never touches the inside of a
string, and never removes the space before a ':' (`.a :hover` and `.a:hover` are
different selectors) or around '+', '-' and '(' (calc() and `and (` need them).
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "styles.src.css")
OUT = os.path.join(ROOT, "styles.css")

BANNER = "/* Generated from styles.src.css by scripts/build-css.py. Edit that, then run scripts/build.py. */\n"
# Whitespace on either side of these is never significant. The newline is the one this
# script writes after each rule.
TIGHT = set("{};,>\n")


def minify(css):
    out = []
    i, n = 0, len(css)
    pending_space = False

    def emit(tok):
        nonlocal pending_space
        if pending_space and out:
            prev = out[-1][-1]
            if prev not in TIGHT and prev != ":" and tok[0] not in TIGHT:
                out.append(" ")
        pending_space = False
        out.append(tok)

    while i < n:
        c = css[i]
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            if j == -1:
                raise SystemExit(f"styles.src.css: unterminated comment at offset {i}")
            i = j + 2
            # A comment between two tokens separates them like whitespace would.
            pending_space = True
        elif c in " \t\r\n\f":
            pending_space = True
            i += 1
        elif c in "\"'":
            j = i + 1
            while j < n and css[j] != c:
                if css[j] == "\\":
                    j += 1
                elif css[j] == "\n":
                    raise SystemExit(f"styles.src.css: unterminated string at offset {i}")
                j += 1
            if j >= n:
                raise SystemExit(f"styles.src.css: unterminated string at offset {i}")
            emit(css[i:j + 1])
            i = j + 1
        elif c == "}":
            # The last declaration in a block needs no terminator.
            if out and out[-1] == ";":
                out.pop()
            pending_space = False
            emit("}")
            out.append("\n")
            i += 1
        else:
            emit(c)
            i += 1
    text = "".join(out)
    return text if text.endswith("\n") else text + "\n"


def main():
    with open(SRC, encoding="utf-8") as f:
        text = BANNER + minify(f.read())
    if "--check" in sys.argv:
        try:
            with open(OUT, encoding="utf-8") as f:
                current = f.read()
        except OSError:
            current = None
        if current != text:
            sys.exit("styles.css is stale or was edited by hand. Edit styles.src.css, "
                     "run 'python3 scripts/build.py' and commit the result.")
        print("styles.css is current.")
        return
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    src = os.path.getsize(SRC)
    print(f"Wrote styles.css from styles.src.css: {src:,} -> {len(text.encode()):,} bytes")


if __name__ == "__main__":
    main()
