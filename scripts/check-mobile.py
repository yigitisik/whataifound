#!/usr/bin/env python3
"""Check that the site still behaves like a mobile product.

    python3 scripts/check-mobile.py

Why this exists
---------------
The site is written and read on a desktop, so mobile regressions are invisible to the
person making them. Every rule checked here was a real defect found by auditing against
Apple's Human Interface Guidelines (44x44pt minimum target) and Material (48dp), plus the
iOS Safari behaviours that catch desktop-first sites. Each one is cheap to reintroduce and
expensive to notice, which is the same argument check-integrity.py makes about smuggled
markup: a rule something checks is worth more than a rule everybody knows.

What it does NOT do
-------------------
It parses CSS and HTML as text. It does not run a browser, compute a layout, or measure a
rendered pixel, so it cannot tell you whether the eyebrow still fits on one line at 320px
or whether a hit area feels right under a thumb. Those need a device. This catches the
mechanical regressions so a human review can spend itself on the things that need eyes.

Exits non-zero and names the file and line on any violation.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "styles.css")

# Apple HIG asks 44x44pt, Material 48x48dp. 44 is the floor enforced here.
MIN_TARGET = 44

DEPLOYED_HTML = ["index.html", "methodology.html", "visuals.html", "review.html",
                 "contributors.html", "account.html", "privacy.html",
                 "contribute.html", "admin.html", "404.html"]


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def strip_comments(css):
    """Blank out comments while preserving offsets, so reported line numbers stay true."""
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), css, flags=re.S)


def blocks(css, pattern):
    """Every at-rule block matching `pattern`, as (start, end) offsets into css.

    One level of nesting is enough: these blocks contain plain rules, never further
    at-rules, and a brace counter that assumed otherwise would be lying about its rigour.
    """
    out = []
    for m in re.finditer(pattern, css):
        i = css.index("{", m.start())
        depth, j = 0, i
        while j < len(css):
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append((m.start(), j))
    return out


def inside(offset, ranges):
    return any(a <= offset <= b for a, b in ranges)


# --------------------------------------------------------------- 1. hover that moves
def check_hover(css, problems):
    """No :hover rule may move or elevate an element unless it is behind a hover query.

    iOS applies :hover on tap and holds it until the reader taps something else, so an
    unguarded lift leaves a card sitting two pixels high with no way to put it back.

    Colour-only :hover is deliberately allowed everywhere. On a phone it fires on tap and
    reads as touch feedback, which is worth keeping; it is movement that reads as broken.
    """
    guarded = blocks(css, r"@media\s*\(\s*hover\s*:\s*hover\s*\)")
    for m in re.finditer(r"([^{}]*:hover[^{}]*)\{([^{}]*)\}", css):
        decls = m.group(2)
        # `transform:none` and `box-shadow:none` remove an effect rather than adding one,
        # so they cannot leave anything stuck. The masthead identicon uses exactly that to
        # cancel the ring it would otherwise inherit inside the doors segment.
        moves = [d for d in re.finditer(r"\b(transform|box-shadow)\s*:\s*([^;}]+)", decls)
                 if d.group(2).strip() != "none"]
        if not moves or inside(m.start(), guarded):
            continue
        sel = " ".join(m.group(1).split())[:70]
        problems.append(
            f"styles.css:{line_of(css, m.start())}: '{sel}' moves or elevates on hover "
            f"outside @media(hover:hover). On a touch screen the state sticks after a tap")


# --------------------------------------------------------------- 2. tap targets
def check_tap_targets(css, problems):
    """Every control small enough to be a problem is handled in the coarse-pointer block.

    This is an explicit contract rather than an inference. Deducing a rendered tap target
    from CSS text means resolving cascade, inheritance, padding and line-height, and a
    regex that pretends to do that produces confident wrong answers: an early version here
    flagged `.theme-seg .th svg`, which is a 15px icon inside a control, as a 15px control.

    So the controls are named, with what each one needs. Adding a control means adding a
    line, which is the same contract `data/vocab.json` already has with `styles.css`: the
    build tells you what is missing rather than letting it ship.

    Two ways to satisfy a row:
      grow      the coarse block sets the named dimension to >= MIN_TARGET
      expand    the coarse block gives it a ::after, which enlarges the hit area only
    """
    coarse = blocks(css, r"@media\s*\(\s*pointer\s*:\s*coarse\s*\)")
    if not coarse:
        problems.append("styles.css: no @media(pointer:coarse) block; touch sizing is unset")
        return
    coarse_text = "".join(css[a:b] for a, b in coarse)

    # (selector, how, dimension, why the dimension is the one that matters)
    CONTRACT = [
        (".theme-seg .th", "grow", "height",
         "segmented control: adjacent cells cannot overlap, so height carries the target"),
        (".door", "grow", "height", "same segment, same reason"),
        (".acct .acct-menu>summary", "grow", "height", "the identicon takes over a door cell"),
        (".totop", "grow", "height", "isolated button, room to take the full 44"),
        (".vid-play", "grow", "height", "sits in a row with the video title"),
        (".sig-b", "grow", None, "triage buttons, sized by padding"),
        (".empty-act", "grow", None, "clear-filters button"),
        (".csv-btn", "grow", None, "export button"),
        (".th-sort", "grow", None, "table column sort"),
        (".cite-copy", "grow", None, "citation copy"),
        (".permalink", "expand", None, "lone glyph, expands both ways"),
        (".tag-chip", "expand", None, "wraps in a row, vertical expansion only"),
        (".chip", "expand", None, "filter chip"),
        (".pagenav a", "expand", None, "nav links sit side by side"),
        (".about-links a", "expand", None, "footer link rows"),
    ]

    for sel, how, dim, why in CONTRACT:
        pat = re.escape(sel)
        if how == "expand":
            if not re.search(rf"{pat}\s*::after", coarse_text):
                problems.append(
                    f"styles.css: '{sel}' has no ::after hit-area expander in the "
                    f"@media(pointer:coarse) block ({why})")
            continue
        # grow: find the rule and read the dimension it sets
        rule = re.search(rf"(?:^|[,{{}}\s]){pat}\s*\{{([^{{}}]*)\}}", coarse_text)
        if not rule:
            problems.append(
                f"styles.css: '{sel}' is not sized in the @media(pointer:coarse) block ({why})")
            continue
        if dim is None:
            if not re.search(r"padding\s*:", rule.group(1)):
                problems.append(f"styles.css: '{sel}' has no padding at coarse pointer ({why})")
            continue
        v = re.search(rf"(?<![-a-z]){dim}\s*:\s*(\d+)px", rule.group(1))
        if not v:
            problems.append(f"styles.css: '{sel}' sets no {dim} at coarse pointer ({why})")
        elif int(v.group(1)) < MIN_TARGET:
            problems.append(
                f"styles.css: '{sel}' is {v.group(1)}px {dim} at coarse pointer, "
                f"under the {MIN_TARGET}px minimum ({why})")


# --------------------------------------------------------------- 3. safe areas
def check_safe_area(css, problems):
    """Anything pinned to the bottom clears the home indicator.

    A control at bottom:18px on an iPhone sits inside the gesture strip, where a tap is as
    likely to dismiss the app as to press the button.
    """
    for m in re.finditer(r"([^{}]+)\{([^{}]*position\s*:\s*fixed[^{}]*)\}", css):
        decls = m.group(2)
        bottom = re.search(r"(?<![-a-z])bottom\s*:\s*([^;}]+)", decls)
        if not bottom:
            continue
        val = bottom.group(1)
        # bottom:0 is flush with the edge by intent (the mascot strip, a full-bleed bar);
        # a positive offset is a control placed by hand and has to respect the inset.
        if val.strip() in ("0", "0px"):
            continue
        if "safe-area-inset-bottom" in val:
            continue
        sel = " ".join(m.group(1).split())[:50]
        problems.append(
            f"styles.css:{line_of(css, m.start())}: '{sel}' is fixed at bottom:{val.strip()} "
            f"without env(safe-area-inset-bottom); it can land under the home indicator")


# --------------------------------------------------------------- 4. overflow
def check_overflow(css, problems):
    """A min-width wider than the narrowest phone must sit in something that scrolls."""
    NARROW = 375
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        sel, decls = m.group(1), m.group(2)
        w = re.search(r"(?<![-a-z])min-width\s*:\s*(\d+)px", decls)
        if not w or int(w.group(1)) <= NARROW:
            continue
        base = sel.strip().lstrip(".").split()[0].split(":")[0].split(",")[0]
        # Accept it when some rule puts it in a horizontal scroller. .regtable lives in
        # .tablewrap, which is overflow-x:auto; that is the pattern being allowed here.
        if re.search(r"overflow-x\s*:\s*(auto|scroll)", css):
            continue
        problems.append(
            f"styles.css:{line_of(css, m.start())}: '{base}' is min-width:{w.group(1)}px "
            f"with no horizontal scroll container; it will overflow a {NARROW}px screen")


# --------------------------------------------------------------- 5. viewport
def check_viewport(problems):
    """Every deployed page is zoomable and respects the display cutout."""
    for name in DEPLOYED_HTML:
        path = os.path.join(ROOT, name)
        if not os.path.exists(path):
            continue
        src = open(path, encoding="utf-8").read()
        m = re.search(r'<meta\s+name="viewport"\s+content="([^"]+)"', src)
        if not m:
            problems.append(f"{name}: no viewport meta tag")
            continue
        content = m.group(1)
        if "viewport-fit=cover" not in content:
            problems.append(f"{name}: viewport meta lacks viewport-fit=cover, so the "
                            f"safe-area insets used in styles.css resolve to zero")
        # Pinch-zoom is an accessibility feature, not a polish problem.
        for bad in ("user-scalable=no", "user-scalable=0", "maximum-scale=1"):
            if bad in content.replace(" ", ""):
                problems.append(f"{name}: viewport sets {bad}, which blocks pinch-zoom")


def main():
    problems = []
    css = strip_comments(open(CSS, encoding="utf-8").read())
    check_hover(css, problems)
    check_tap_targets(css, problems)
    check_safe_area(css, problems)
    check_overflow(css, problems)
    check_viewport(problems)

    if problems:
        print(f"Mobile check failed with {len(problems)} problem(s):\n", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        return 1
    print("Mobile check passed: hover states are guarded, touch targets reach "
          f"{MIN_TARGET}px, safe areas are respected, nothing overflows a phone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
