#!/usr/bin/env python3
"""Pre-render the registry into static HTML, and generate per-entry pages, llms.txt and the sitemap.

Why this exists
---------------
index.html used to ship an empty <main id="list"> that app.js filled in after fetching
data/entries.json. Google renders JS eventually, but the AI crawlers robots.txt explicitly
invites (GPTBot, ClaudeBot, PerplexityBot, CCBot) largely do not, so every one of them
arrived at a registry of AI discoveries that contained no AI discoveries.

This writes the entries into the markup that ships, so the content is there before a line
of JavaScript runs. data/entries.json stays the single source of truth; app.js still owns
search, filtering and re-rendering, and simply skips its first paint when the server-rendered
markup is already in place (see the data-prerendered flag on #list).

The card markup below is a port of card() in app.js and must stay in step with it: a
mismatch means the DOM visibly changes on hydration. verify-parity.py checks this.

    python3 scripts/build-site.py

Outputs (all git-tracked, all deployed):
    index.html          # <main id="list"> filled in, stats + updated date baked in
    finding/<id>.html   # one citable page per entry, with ClaimReview JSON-LD
    llms.txt            # markdown map of the registry for LLM crawlers
    sitemap.xml         # 3 core pages + one URL per entry

SITE must match index.html, methodology.html, visuals.html, robots.txt and build-feed.py.
"""
import html
import json
import math
import os
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
# No datetime import on purpose: every date written by this script comes from
# data/entries.json. The output is committed and CI rebuilds it, so anything derived
# from the clock would make the build non-reproducible and fail the drift check on a
# later day. See build_sitemap().
from urllib.parse import quote, urlparse

SITE = "https://whataifound.org"
# Where a reader is sent to contest a grade. Every finding page links here with the entry
# and its current grades prefilled, so a challenge arrives as a reviewable issue rather
# than an email. The repo URL is also hand-written in the static HTML headers and footers;
# this constant covers only what the build generates.
REPO = "https://github.com/yigitisik/whataifound"

# GitHub Discussions has to be switched on in repo settings before any /discussions URL
# resolves; until then every one of them 404s, which is worse than not offering the link.
# Flip this to True once it is enabled. DISCUSSION_CATEGORY must be a category that
# actually exists: "general" is created by default, "findings" is not.
DISCUSSIONS = False
DISCUSSION_CATEGORY = "general"

# Every page in the site, in nav order. One list so the nav, the sitemap and llms.txt
# cannot disagree about what exists; adding a page means adding a line here.
PAGES = [
    ("/", "Registry", "weekly", "1.0"),
    ("/review", "Review queue", "weekly", "0.6"),
    ("/visuals", "Visuals", "weekly", "0.7"),
    ("/methodology", "Methodology", "monthly", "0.7"),
    ("/contributors", "Contributors", "monthly", "0.5"),
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- vocabulary
# The grading scales come from data/vocab.json, which is the single source of truth:
# these tables, app.js's copies, the methodology page and llms.txt are all derived from
# it, so a label or definition is edited in exactly one place. Array order is display
# order (strongest to weakest).
with open(os.path.join(ROOT, "data", "vocab.json")) as _f:
    VOCAB = json.load(_f)

VER = VOCAB["verification"]
AUT = VOCAB["autonomy"]
VER_LABEL = {v["slug"]: v["label"] for v in VER}
AUT_LABEL = {a["slug"]: a["label"] for a in AUT}

# Positions on the two axes of the evidence/autonomy matrix. Both are derived here so
# data/vocab.json stays the only place a grade is defined.
#
# Autonomy is a plain ladder, so rank comes straight from display order (documented in
# vocab.json as most-to-least AI-driven): reordering the vocabulary reorders the axis.
AUT_RANK = {a["slug"]: len(AUT) - 1 - i for i, a in enumerate(AUT)}

# Verification is NOT a plain ladder: three grades are negative findings, and they mean
# different things. "Already known" is a correct result that simply wasn't new, whereas
# "Disputed" and "Refuted" are evidence the claim is wrong. Ranking them 1-2 on the same
# scale as "Claimed" would put a refuted result above nothing at all, so the axis is
# signed instead: evidence for the claim above zero, evidence against it below.
# Formal outranks Independent here even though both carry rating 5 in vocab.json, since
# a machine-checked proof is the stronger of the two for this chart's purpose.
VER_SCORE = {
    "formal": 4, "independent": 3, "peer-reviewed": 3, "author-verified": 2,
    "claimed": 1, "known": -1, "disputed": -2, "refuted": -3,
}
_missing = [v["slug"] for v in VER if v["slug"] not in VER_SCORE]
if _missing:                      # a new grade must be placed deliberately, not defaulted
    raise SystemExit(f"VER_SCORE in build-site.py is missing: {', '.join(_missing)}")

# How each verification grade maps onto a schema.org Rating, so a machine reading
# ClaimReview gets the same ordering a reader gets from the pill colours. 5 = the
# claim stands up; 1 = it does not. "known" is a true result that is not new, so it
# sits mid-scale rather than at the bottom.
VER_RATING = {v["slug"]: (v["rating"], v["rating_label"]) for v in VER}

# Display names for the `field` values in use. A new field needs a line in vocab.json.
# The build refuses to run otherwise, rather than printing a raw slug like
# "computer-science" into a headline.
FIELD_LABEL = VOCAB["fields"]

LAB_LOGO = {
    "Anthropic": "assets/external-logos/anthropic.svg",
    "OpenAI": "assets/external-logos/openai.svg",
    "OpenAI / Harmonic": "assets/external-logos/openai.svg",
    "Google DeepMind": "assets/external-logos/deepmind.svg",
    "Google": "assets/external-logos/google.svg",
}
LAB_MARK = {
    "FutureHouse": ("F", "#7a5cd0"),
    "Lawrence Berkeley National Laboratory": ("LB", "#1d4e89"),
    "Independent": ("IN", "#7c7a72"),
}
DOMAIN_NAME = {
    "nature.com": "Nature", "arxiv.org": "arXiv", "news.ycombinator.com": "Hacker News",
    "en.wikipedia.org": "Wikipedia", "quantamagazine.org": "Quanta",
    "theregister.com": "The Register", "deepmind.google": "DeepMind",
    "spectrum.ieee.org": "IEEE Spectrum", "github.com": "GitHub",
    "ncbi.nlm.nih.gov": "NIH PMC", "techcrunch.com": "TechCrunch",
    "the-decoder.com": "The Decoder", "unite.ai": "Unite.AI", "hackmd.io": "HackMD",
    "allthings.how": "AllThings.how", "turingpost.com": "Turing Post",
    "techjacksolutions.com": "Tech Jacks", "nobelprize.org": "Nobel Prize",
    "actu.epfl.ch": "EPFL", "storage.googleapis.com": "DeepMind",
}


def enc_uri_component(s):
    """JavaScript's encodeURIComponent, which urllib.parse.quote is not.

    quote() percent-encodes ! ' ( ) *; encodeURIComponent leaves them alone. app.js
    uses encodeURIComponent on youtube_id, so quote() would emit different bytes and
    fail verify-parity on any id containing those characters.
    """
    return quote(str(s), safe="!'()*-._~")


def esc(s):
    """The exact escape app.js's esc() performs: & < > " and nothing else.

    Notably NOT html.escape(), which also encodes ' as &#x27;, which would make the
    server-rendered markup differ from the client-rendered markup on any entry with
    an apostrophe, which is most of them.
    """
    if s is None:
        return ""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def attr(s):
    """Escape for an HTML attribute in a hand-written template (not a card() port)."""
    return html.escape(str(s or ""), quote=True)


def json_ld(obj):
    """Serialise a JSON-LD graph for embedding in a <script> block.

    Inside <script>, the HTML parser looks for the literal "</script" before the JSON
    parser ever sees the text, so an entry whose title or claim contained "</script>"
    would terminate the block early and inject the remainder as markup. The escape is
    on the JSON string level (\\u003c is the same character to a JSON reader), so the
    structured data is unchanged for consumers. <!-- and --> get the same treatment,
    since they can also confuse the parser inside a script element.

    The registry is a single hand-maintained file, so this is defence in depth rather
    than a live hole, but the whole point of the pipeline is that adding an entry
    means editing JSON and nothing else, and that has to stay true for any string.
    """
    return (json.dumps(obj, indent=2, ensure_ascii=False)
            .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))


# ------------------------------------------------------------ card() port
# Everything from here to card() mirrors app.js line for line. Whitespace matters:
# it is reproduced so a diff against the hydrated DOM is empty.

def lab_mark(lab):
    src = LAB_LOGO.get(lab)
    if src:
        return f'<span class="labchip img" aria-hidden="true"><img src="{esc(src)}" alt=""></span>'
    if lab in LAB_MARK:
        t, c = LAB_MARK[lab]
    else:
        t, c = (lab or "?").strip()[:1].upper(), "#7c7a72"
    return f'<span class="labchip" style="--lc:{c}" aria-hidden="true">{esc(t)}</span>'


def domain_of(url):
    try:
        h = urlparse(url).hostname or ""
        h = re.sub(r"^www\.", "", h)
        return DOMAIN_NAME.get(h, h)
    except Exception:
        return ""


def ref_row(s):
    dom = domain_of(s.get("url", ""))
    label = s.get("label") or ""
    i = label.find(": ")
    if i > 0 and label[:i].strip().lower() == dom.lower():
        label = label[i + 2:]
    return (f'<a class="ref" href="{esc(s.get("url"))}" target="_blank" rel="noopener">'
            f'<span class="ref-dom">{esc(dom)}</span><span class="ref-t">{esc(label)}</span>'
            f'<span class="ref-a">↗</span></a>')


def page_nav(current):
    """The bar that links every page to every other page.

    Before this, each sub-page could only go back to the registry, so getting from the
    review queue to the contributors page meant two hops through the homepage. It is
    generated from PAGES rather than hand-written into five files, because five
    hand-maintained copies of a nav is five chances for one to fall out of date.

    `current` is the path of the page being built, or None on finding pages, which are
    below all of these rather than beside them.
    """
    items = ""
    for path, label, _, _ in PAGES:
        here = ' aria-current="page"' if path == current else ""
        items += f'<a href="{path}"{here}>{esc(label)}</a>'
    return f'<nav class="pagenav" aria-label="Site">{items}</nav>'


def person(p):
    """One credited person. A GitHub handle becomes a link; a bare name stays text."""
    name = esc(p.get("name"))
    gh = str(p.get("github") or "").lstrip("@")
    # Handles are the only thing here that becomes an href, so constrain them to
    # GitHub's own character set rather than trusting the value.
    if gh and re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", gh):
        name = (f'<a href="https://github.com/{esc(gh)}" target="_blank" '
                f'rel="noopener">{name}</a>')
    note = f' <span class="credit-note">{esc(p["note"])}</span>' if p.get("note") else ""
    return f'<li>{name}{note}</li>'


def credit_block(e):
    """Who built this registry entry, as distinct from who made the discovery.

    `lab` and `humans` credit the discovery. These credit the people who put the record
    here and checked it, which is the currency the project pays contributors in. Rendered
    on finding pages only: card() is mirrored in app.js and enforced by verify-parity.py,
    and there is no reason to carry a second dual-maintained renderer for this.
    """
    rows = ""
    for field, label in (("contributors", "Contributed by"), ("reviewers", "Reviewed by")):
        people = e.get(field) or []
        if people:
            rows += (f'<div class="credit-row"><b>{label}</b>'
                     f'<ul>{"".join(person(p) for p in people)}</ul></div>')
    if not rows:
        return ""
    return (f'<h2 class="lbl">Credit</h2><div class="credit">{rows}</div>')


def years_open(e):
    """Derived, never stored: how long the problem stood before this result."""
    if e.get("year_posed") is None:
        return None
    try:
        resolved = int(str(e.get("date", ""))[:4])
    except ValueError:
        return None
    n = resolved - e["year_posed"]
    return n if n >= 0 else None


def open_meta(e):
    n = years_open(e)
    if n is None:
        return ""
    span = "same year" if n == 0 else f"open {n} yr{'' if n == 1 else 's'}"
    return f"<div><dt>Posed</dt><dd>{e['year_posed']} · {span}</dd></div>"


def notability_meta(e):
    v = e.get("notability")
    if v is None:
        return ""
    return f"<div><dt>Notability</dt><dd>{v} Wikipedia edition{'' if v == 1 else 's'}</dd></div>"


def card(e):
    """Port of card() in app.js. Output must match it character for character."""
    def f(label, val):
        return f'<div class="field reveal"><b>{label}</b><p>{esc(val)}</p></div>' if val else ""

    checks = "".join(
        f'<p>{esc(c.get("who"))}: <em>{esc(c.get("outcome"))}</em>'
        + (f' · <a href="{esc(c["url"])}" target="_blank" rel="noopener">link ↗</a>' if c.get("url") else "")
        + "</p>"
        for c in (e.get("independent_checks") or []))

    def refs(arr):
        return '<div class="refs">' + "".join(ref_row(s) for s in (arr or [])) + "</div>"

    humans = (f'<p class="withppl"><span>With</span><b>{esc(", ".join(e["humans"]))}</b></p>'
              if e.get("humans") else "")
    tags = ('<div class="tags">'
            + "".join(f'<span class="tag-chip">{esc(t)}</span>' for t in e["tags"])
            + "</div>") if e.get("tags") else ""
    detail = f'<p class="detail">{esc(e["detail"])}</p>' if e.get("detail") else ""
    checks_block = (f'<div class="field checks reveal"><b>Independent checks</b>{checks}</div>'
                    if checks else "")
    sources_block = (f'<div class="field reveal"><b>Sources</b>{refs(e["sources"])}</div>'
                     if e.get("sources") else "")
    disc_block = (f'<div class="field reveal"><b>Community discussion</b>{refs(e["discussion"])}</div>'
                  if e.get("discussion") else "")

    if e.get("videos"):
        vids = "".join(
            f'<div class="vid" data-yt="{esc(v["youtube_id"])}">\n'
            f'            <button class="vid-play" type="button" aria-label="Play video: {esc(v["label"])}">&#9654;</button>\n'
            f'            <span class="vid-meta"><span class="vid-t">{esc(v["label"])}</span>'
            f'<span class="vid-ch">{esc(v["channel"])}</span></span>\n'
            f'            <a class="vid-ext" href="https://www.youtube.com/watch?v={enc_uri_component(v["youtube_id"])}" '
            f'target="_blank" rel="noopener">YouTube ↗</a>\n'
            f'          </div>'
            for v in e["videos"])
        videos_block = (f'<div class="field reveal"><b>Video explainers</b>\n'
                        f'          {vids}\n'
                        f'          <p class="vid-note">Nothing loads from YouTube until you press play.</p>\n'
                        f'        </div>')
    else:
        videos_block = ""

    return f'''<article class="entry" id="e-{esc(e["id"])}" data-ver="{esc(e["verification"])}">
    <div class="rail">
      <div class="lab">{lab_mark(e.get("lab"))}<span class="lab-name">{esc(e.get("lab"))}</span></div>
      <div class="rdate">{esc(e.get("date"))}</div>
      <div class="rpills">
        <span class="pill v v-{esc(e["verification"])}">{esc(VER_LABEL.get(e["verification"], e["verification"]))}</span>
        <span class="pill a">{esc(AUT_LABEL.get(e["autonomy"], e["autonomy"]))}</span>
      </div>
      <dl class="rmeta">
        <div><dt>Model</dt><dd>{esc(e.get("model"))}</dd></div>
        <div><dt>Field</dt><dd>{esc(e.get("field"))}</dd></div>
        {open_meta(e)}
        {notability_meta(e)}
      </dl>
    </div>
    <div class="body">
      <h2><a class="entry-link" href="/finding/{esc(e["id"])}">{esc(e["title"])}</a><a class="permalink" href="#e-{esc(e["id"])}" data-permalink="e-{esc(e["id"])}" aria-label="Copy link to this entry" title="Copy link to this entry">#</a></h2>
      <p class="claim">{esc(e["claim"])}</p>
      {detail}
      {humans}
      {tags}
      <details>
        <summary>Novelty check, caveats &amp; sources</summary>
        {f("Novelty check", e.get("novelty_check"))}
        {f("Caveats", e.get("caveats"))}
        {checks_block}
        {sources_block}
        {disc_block}
        {videos_block}
      </details>
    </div>
  </article>'''


# ------------------------------------------------------------------ evidence matrix
# A hand-port of matrixCard() in app.js, byte for byte. The homepage leads with this chart,
# and the hero is pre-rendered for the same reason the entries are: the AI crawlers
# robots.txt invites do not run JavaScript, and a hero whose only content is an empty
# <div> tells them nothing. app.js still owns the copy visuals.html mounts.
#
# verify-parity.py runs the real matrixCard() under Node and diffs it against what this
# writes, so the two cannot drift silently. Change one, change the other, in the same PR.

# Autonomy is the axis this registry owns, so it is the colour key of both plots.
AUT_COLOR = {
    "autonomous": "var(--formal)", "ai-led": "var(--independent)",
    "collaborative": "var(--peer)", "ai-assisted": "var(--author)",
    "search-scaffold": "var(--disputed)", "retrieval": "var(--known)",
}

# One label per distinct verification score. Grades that share a score share a row, so the
# label names the row, not any single grade.
VROW = {4: "Formal", 3: "Independent / peer", 2: "Author verified", 1: "Claimed",
        -1: "Already known", -2: "Disputed", -3: "Refuted"}


def fixed1(x):
    """JS Number.prototype.toFixed(1).

    Not f"{x:.1f}": Python rounds halves to even, JS picks the larger n on a tie. Every
    coordinate on this chart is positive, so ROUND_HALF_UP against the exact binary value
    of the double reproduces toFixed. A half-pixel disagreement here is a parity failure.
    """
    return str(Decimal(x).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def matrix_card(entries):
    """The registry's two axes plotted against each other, as one <div class="qv-card">.

    `entries` must arrive in the order app.js's boot() sorts them (date descending): cell
    order follows first appearance, and a different order permutes the markup.
    """
    pts = [e for e in entries
           if VER_SCORE.get(e.get("verification")) is not None
           and AUT_RANK.get(e.get("autonomy")) is not None]
    missing = len(entries) - len(pts)
    if not pts:
        return ('<div class="qv-card"><h3 class="qv-title">Evidence vs. autonomy</h3>'
                '<p class="qv-empty">No entries carry both a verification grade and an '
                'autonomy grade yet.</p></div>')

    # Group by cell, keeping the entries so the tooltip can name them.
    cells = {}
    for e in pts:
        key = (AUT_RANK[e["autonomy"]], VER_SCORE[e["verification"]])
        cells.setdefault(key, {"ax": key[0], "vy": key[1], "list": []})["list"].append(e)

    # Axis domains come from the vocabulary, not the data, so an empty column or row still
    # shows: "nothing is autonomous and refuted" is a finding, and a chart that silently
    # dropped that column would hide it.
    ax_ranks = sorted(set(AUT_RANK.values()))
    vy_scores = sorted(set(VER_SCORE.values()))
    ax_min, ax_max = min(ax_ranks), max(ax_ranks)

    # Rows are positioned by their index in the score list, not by the score itself: the
    # scale skips 0 (there is no neutral grade), so spacing by value would leave a gap
    # twice the height of every other row straddling the zero line.
    W, H, PADL, PADR, PADT, PADB = 470, 310, 108, 12, 10, 70
    cw = (W - PADL - PADR) / (ax_max - ax_min + 1)
    ch = (H - PADT - PADB) / len(vy_scores)

    def cx(a):
        return PADL + (a - ax_min + 0.5) * cw

    def cy(v):
        return H - PADB - (vy_scores.index(v) + 0.5) * ch

    # Area-proportional radius: doubling the count doubles the ink, not the width.
    max_n = max(len(c["list"]) for c in cells.values())
    r_max = min(cw, ch) / 2 - 3

    def r_of(n):
        return max(3.5, r_max * math.sqrt(n / max_n))

    by_rank = {r: slug for slug, r in AUT_RANK.items()}

    # A single label per autonomy column, rotated: the full labels ("Search scaffold") do
    # not fit horizontally in a half-width card.
    label_y = H - PADB + 13
    xlabels = "".join(
        f'<text x="{fixed1(cx(a))}" y="{label_y}" class="mx-tick" text-anchor="end"'
        f' transform="rotate(-35 {fixed1(cx(a))} {label_y})">'
        f'{esc(AUT_LABEL.get(by_rank[a], by_rank[a]))}</text>'
        for a in ax_ranks)

    ylabels = "".join(
        f'<text x="{PADL - 9}" y="{fixed1(cy(v) + 3.5)}" class="mx-tick" text-anchor="end">'
        f'{esc(VROW.get(v, v))}</text>'
        for v in vy_scores)

    # Faint cell guides, plus the zero line: the boundary between evidence for a claim and
    # evidence against it is the one line on this axis worth drawing heavier.
    guides = "".join(
        f'<line x1="{PADL}" y1="{fixed1(cy(v))}" x2="{W - PADR}" y2="{fixed1(cy(v))}"'
        f' class="mx-guide"/>'
        for v in vy_scores)
    first_pos = next((i for i, v in enumerate(vy_scores) if v > 0), -1)
    if first_pos > 0:
        zero_y = H - PADB - first_pos * ch
        guides += (
            f'<line x1="{PADL}" y1="{fixed1(zero_y)}" x2="{W - PADR}" y2="{fixed1(zero_y)}"'
            f' class="mx-zero"/>'
            f'<text x="{W - PADR}" y="{fixed1(zero_y - 4)}" class="mx-zlab"'
            f' text-anchor="end">supports the claim ↑</text>'
            f'<text x="{W - PADR}" y="{fixed1(zero_y + 11)}" class="mx-zlab"'
            f' text-anchor="end">counts against it ↓</text>')

    dots = ""
    for c in cells.values():
        n = len(c["list"])
        slug = by_rank[c["ax"]]
        col = AUT_COLOR.get(slug, "var(--muted)")
        names = " · ".join(x["title"] for x in c["list"][:4]) + (
            f" · +{n - 4} more" if n > 4 else "")
        vlab, alab = VROW.get(c["vy"], c["vy"]), AUT_LABEL.get(slug)
        s = "" if n == 1 else "s"
        dots += (
            f'<circle cx="{fixed1(cx(c["ax"]))}" cy="{fixed1(cy(c["vy"]))}"'
            f' r="{fixed1(r_of(n))}"'
            f' fill="{col}" class="mx-dot" tabindex="0" role="img"'
            f' data-title="{esc(f"{alab} · {vlab}")}"'
            f' data-aut="{esc(f"{n} finding{s}")}"'
            f' data-autcol="{col}"'
            f' data-open="{esc(names)}"'
            f' aria-label="{esc(f"{alab}, {vlab}: {n} finding{s}.")}"></circle>')
        if n >= 4:
            dots += (f'<text x="{fixed1(cx(c["ax"]))}" y="{fixed1(cy(c["vy"]) + 3.5)}"'
                     f' class="mx-n" text-anchor="middle">{n}</text>')

    mid_y = (PADT + (H - PADB)) / 2
    axis_titles = (
        f'<text x="{(PADL + (W - PADR)) // 2}" y="{H - 4}" class="sc-axis"'
        f' text-anchor="middle">More AI-driven →</text>'
        f'<text x="10" y="{fixed1(mid_y)}" class="sc-axis" text-anchor="middle"'
        f' transform="rotate(-90 10 {fixed1(mid_y)})">Better evidence →</text>')

    top = sorted(cells.values(), key=lambda c: len(c["list"]), reverse=True)[:3]
    summary = "; ".join(
        f'{AUT_LABEL.get(by_rank[c["ax"]])} and {VROW.get(c["vy"], c["vy"])}: {len(c["list"])}'
        for c in top)
    label = (f"Matrix of verification against autonomy for {len(pts)} findings. "
             f"Circle area is the number of findings in each combination. "
             f"Largest groups: {summary}.")
    note = (f'<p class="qv-foot">{missing} entr{"y" if missing == 1 else "ies"} not shown '
            f'(unrecognised grade).</p>') if missing else ""

    return ('<div class="qv-card"><h3 class="qv-title">Evidence vs. autonomy</h3>'
            '<div class="sc-wrap">'
            f'<svg class="sc" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(label)}"'
            ' preserveAspectRatio="xMidYMid meet">'
            + guides + xlabels + ylabels + axis_titles + dots + '</svg>'
            '<div class="sc-tip" hidden aria-hidden="true"></div>'
            '</div>'
            f'<p class="qv-foot">Circle area = findings in that combination. '
            f'All {len(pts)} entries carry both grades.</p>'
            + note + '</div>')


# ------------------------------------------------------------------ structured data
def claim_review(e, url):
    """ClaimReview: the schema.org type for rating a claim's truthfulness.

    This is the closest match in the vocabulary to what the registry actually does:
    it lets a machine read the verification grade as a rating rather than as prose,
    which is how the site gets treated as an authority instead of another list.
    """
    rating, label = VER_RATING.get(e["verification"], (3, e["verification"]))
    author = e.get("lab") or "Unknown"
    if e.get("model"):
        author = f"{author} ({e['model']})"
    review = {
        "@type": "ClaimReview",
        "@id": f"{url}#claimreview",
        "url": url,
        "claimReviewed": e["claim"],
        "datePublished": e.get("added") or e.get("date"),
        "author": {"@type": "Organization", "name": "whataifound.org", "url": f"{SITE}/"},
        "itemReviewed": {
            "@type": "Claim",
            "name": e["title"],
            "author": {"@type": "Organization", "name": author},
            "datePublished": e.get("date"),
            "appearance": [{"@type": "CreativeWork", "url": s["url"]}
                           for s in (e.get("sources") or []) if s.get("url")],
        },
        "reviewRating": {
            "@type": "Rating",
            "ratingValue": rating,
            "bestRating": 5,
            "worstRating": 1,
            "alternateName": label,
        },
    }
    if e.get("novelty_check"):
        review["reviewBody"] = e["novelty_check"]
    return review


def entry_jsonld(e, url):
    """The graph for a single finding page: the page, the claim review, breadcrumbs."""
    aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
    ver = VER_LABEL.get(e["verification"], e["verification"])
    article = {
        "@type": "ScholarlyArticle",
        "@id": f"{url}#article",
        "url": url,
        "headline": e["title"],
        "name": e["title"],
        "abstract": e["claim"],
        "description": e["claim"],
        "datePublished": e.get("date"),
        "dateModified": e.get("added") or e.get("date"),
        "inLanguage": "en",
        "isPartOf": {"@id": f"{SITE}/#dataset"},
        "publisher": {"@type": "Organization", "name": "whataifound.org", "url": f"{SITE}/"},
        "about": FIELD_LABEL.get(e.get("field"), e.get("field")),
        "keywords": (e.get("tags") or []) + [ver, aut],
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "creditText": f"whataifound.org. Verification: {ver}; autonomy: {aut}.",
    }
    if e.get("detail"):
        article["articleBody"] = e["detail"]
    contributors = [{"@type": "Organization", "name": e["lab"]}] if e.get("lab") else []
    contributors += [{"@type": "Person", "name": h} for h in (e.get("humans") or [])]
    if contributors:
        article["contributor"] = contributors
    if e.get("sources"):
        article["citation"] = [{"@type": "CreativeWork", "url": s["url"],
                                "name": s.get("label") or s["url"]}
                               for s in e["sources"] if s.get("url")]
    return {
        "@context": "https://schema.org",
        "@graph": [
            article,
            claim_review(e, url),
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Registry", "item": f"{SITE}/"},
                    {"@type": "ListItem", "position": 2, "name": e["title"], "item": url},
                ],
            },
        ],
    }


# ------------------------------------------------------------------ entry pages
def entry_page(e):
    """A standalone, independently citable page for one finding.

    The point of these is citation surface: an answer engine picks 2–7 sources per
    answer, and a URL that answers exactly one question beats a homepage that
    answers twenty-two. The lede paragraph is written to be quotable on its own:
    it states the verdict before the detail, because the first sentence is what
    gets lifted into an answer.
    """
    url = f"{SITE}/finding/{e['id']}"
    ver = VER_LABEL.get(e["verification"], e["verification"])
    aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
    n = years_open(e)

    # Challenging a grade should cost a reader one click, not a fork. The GitHub issue form
    # prefills from query parameters keyed on each field's id, so the entry and its current
    # grades arrive filled in and the reporter only supplies the citation. esc() escapes the
    # & separators, which an href requires.
    credit = credit_block(e)
    grades = f"verification: {e['verification']}, autonomy: {e['autonomy']}"

    def issue_url(template, title):
        return REPO + "/issues/new?" + "&".join([
            f"template={template}",
            "title=" + enc_uri_component(title),
            "entry=" + enc_uri_component(e["id"]),
            "current=" + enc_uri_component(grades),
        ])

    challenge = issue_url("grade-challenge.yml", f"Grade challenge: {e['id']}")
    check = issue_url("independent-check.yml", f"Independent check: {e['id']}")
    # Discussions take a title and body, not the issue-form field ids. Rendered only when
    # DISCUSSIONS is on: a /discussions URL against a repo that has not enabled the
    # feature 404s, and so does a category that does not exist.
    discuss = ""
    if DISCUSSIONS:
        discuss = (f'<a class="challenge-alt" href="'
                   + esc(REPO + f"/discussions/new?category={DISCUSSION_CATEGORY}&title="
                         + enc_uri_component(e["title"]) + "&body="
                         + enc_uri_component(f"About {url}\n\nCurrently graded {grades}.\n\n"))
                   + '" target="_blank" rel="noopener">or discuss it'
                   + '<span aria-hidden="true"> ↗</span></a>')
    # An entry nobody has checked is the one most worth checking, so the ask leads with
    # that. Once a check exists the panel reverts to leading with the challenge, since
    # the open question is then whether the grade is right rather than whether anyone
    # has looked. Both actions are always present; only the order and framing change.
    unchecked = not e.get("independent_checks")
    if unchecked:
        ask_title = "Nobody has independently checked this yet."
        ask_body = ("A grade of <strong>independently checked</strong> needs someone unaffiliated "
                    "with the lab to confirm the result. Reading the primary source closely enough "
                    "to say whether it supports the claim counts, and you are credited on the entry.")
    else:
        ask_title = "Disagree with these grades?"
        ask_body = ("Entries are never deleted. A grade that does not hold up is downgraded on the "
                    "record and the objection is kept beside it. Bring a citation.")

    verdict = (f"{e['title']} is graded {ver.lower()} on whataifound.org, with the AI's "
               f"role graded {aut.lower()}.")
    meta_desc = f"{verdict} {e['claim']}"[:300]

    ld = json_ld(entry_jsonld(e, url))

    facts = [("Verification", ver), ("Autonomy", aut), ("Lab", e.get("lab")),
             ("Model", e.get("model")),
             ("Field", FIELD_LABEL.get(e.get("field"), e.get("field"))),
             ("Date", e.get("date"))]
    if e.get("humans"):
        facts.append(("Human collaborators", ", ".join(e["humans"])))
    if e.get("year_posed") is not None:
        facts.append(("Problem posed", str(e["year_posed"])
                      + (f" · open {n} yr{'' if n == 1 else 's'}" if n else "")))
    if e.get("notability") is not None:
        facts.append(("Notability", f"{e['notability']} Wikipedia language edition"
                                    f"{'' if e['notability'] == 1 else 's'}"))
    fact_rows = "\n".join(
        f"      <div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>"
        for k, v in facts if v)

    def section(title, body):
        return f'\n  <h2 class="lbl">{esc(title)}</h2>\n  <p>{esc(body)}</p>' if body else ""

    sources = ""
    if e.get("sources"):
        sources = ('\n  <h2 class="lbl">Sources</h2>\n  <div class="refs">'
                   + "".join(ref_row(s) for s in e["sources"]) + "</div>")
    discussion = ""
    if e.get("discussion"):
        discussion = ('\n  <h2 class="lbl">Community discussion</h2>\n  <div class="refs">'
                      + "".join(ref_row(s) for s in e["discussion"]) + "</div>")
    checks = ""
    if e.get("independent_checks"):
        rows = "".join(
            f'<p>{esc(c.get("who"))}: <em>{esc(c.get("outcome"))}</em>'
            + (f' · <a href="{esc(c["url"])}" target="_blank" rel="noopener">link ↗</a>'
               if c.get("url") else "") + "</p>"
            for c in e["independent_checks"])
        checks = f'\n  <h2 class="lbl">Independent checks</h2>\n  <div class="checks">{rows}</div>'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#111310">

<title>{esc(e["title"])}: graded {esc(ver)} | whataifound.org</title>
<meta name="description" content="{attr(meta_desc)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="{url}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="whataifound.org">
<meta property="og:title" content="{attr(e["title"])}">
<meta property="og:description" content="{attr(meta_desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/assets/brand/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="{attr(e.get("date"))}">
<meta property="og:locale" content="en_US">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{attr(e["title"])}">
<meta name="twitter:description" content="{attr(meta_desc)}">
<meta name="twitter:image" content="{SITE}/assets/brand/og.png">

<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/brand/icon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<link rel="mask-icon" href="/assets/brand/favicon.svg" color="#0b0d10">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/feed+json" href="/feed.json" title="whataifound.org (JSON Feed)">
<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="whataifound.org (RSS)">

<script type="application/ld+json">
{ld}
</script>

<script>try{{var tm=localStorage.getItem('theme'),el=document.documentElement;if(tm==='light'||tm==='dark')el.setAttribute('data-theme',tm);else if(tm!=='system')el.setAttribute('data-theme','dark');
/* Match the chrome tint to the theme that rendered; the static tag is the dark default. */
var lt=tm==='light'||(tm==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);
if(lt){{var m=document.querySelector('meta[name=theme-color]');if(m)m.content='#faf9f6';}}}}catch(e){{}}</script>

<link rel="stylesheet" href="/styles.css">
</head>
<body class="finding-page">
<div class="spectrum" aria-hidden="true"></div>
<div class="wrap">

{page_nav(None)}
<nav class="crumb" aria-label="Breadcrumb">
  <a href="/">whataifound.org</a> <span aria-hidden="true">/</span>
  <a href="/#e-{esc(e["id"])}">{esc(FIELD_LABEL.get(e.get("field"), e.get("field")))}</a>
  <span aria-hidden="true">/</span> <span>Finding</span>
</nav>

<article class="finding">
  <div class="finding-pills">
    <span class="pill v v-{esc(e["verification"])}">{esc(ver)}</span>
    <span class="pill a">{esc(aut)}</span>
  </div>
  <h1>{esc(e["title"])}</h1>
  <p class="lede">{esc(verdict)}</p>
  <p class="claim">{esc(e.get("claim"))}</p>

  <dl class="finding-facts">
{fact_rows}
  </dl>

  <div class="challenge">
    <p class="challenge-t">{esc(ask_title)}</p>
    <p class="challenge-d">{ask_body}</p>
    <div class="challenge-acts">
      <a class="btn primary challenge-b" href="{esc(check if unchecked else challenge)}"
         target="_blank" rel="noopener">{"Submit a check" if unchecked else "Challenge this grade"}<span aria-hidden="true"> ↗</span></a>
      <a class="btn challenge-b" href="{esc(challenge if unchecked else check)}"
         target="_blank" rel="noopener">{"Challenge the grade" if unchecked else "Submit a check"}<span aria-hidden="true"> ↗</span></a>
      {discuss}
    </div>
  </div>
{section("What was found", e.get("detail"))}{section("Novelty check", e.get("novelty_check"))}{section("Caveats", e.get("caveats"))}{checks}{sources}{discussion}

  <h2 class="lbl">How this is graded</h2>
  <p>whataifound.org grades every entry on two axes: <strong>verification</strong> (how solid the
  result is, from a machine-checked proof down to refuted) and <strong>autonomy</strong> (how much
  the AI did versus its human collaborators). This finding is <strong>{esc(ver.lower())}</strong>
  and <strong>{esc(aut.lower())}</strong>. Full definitions are in the
  <a href="/methodology">methodology</a>.</p>

{credit}
  <h2 class="lbl">Cite this entry</h2>
  <p class="cite">whataifound.org ({esc(str(e.get("date", ""))[:4])}). <em>{esc(e["title"])}.</em>
  whataifound.org: A Registry of AI Scientific and Mathematical Discoveries. {url}</p>

  <p class="finding-back"><a href="/#e-{esc(e["id"])}">← All {esc(FIELD_LABEL.get(e.get("field"), e.get("field")))
  .lower()} findings in the registry</a></p>
</article>

</div>
</body>
</html>
'''


# ------------------------------------------------------------------ llms.txt
def build_llms_txt(entries):
    """A markdown map of the registry, at the root, for LLM crawlers.

    Answer engines ingest this far more reliably than they render a JS app. It states
    what the registry is, what the grades mean, and links every entry, so a model
    that never runs app.js can still cite an individual finding accurately.
    """
    by_field = {}
    for e in entries:
        by_field.setdefault(e.get("field", "other"), []).append(e)

    lines = [
        "# whataifound.org",
        "",
        "> A curated, independently graded registry of scientific and mathematical results",
        "> discovered by or with AI systems. Every entry is graded on how it was verified and",
        "> how much the AI actually did, so a machine-checked proof is never confused with a",
        "> press release. Negative results (already known, disputed, refuted) stay on the",
        "> record rather than being deleted.",
        "",
        f"Maintained as an independent editorial project. {len(entries)} entries on record. "
        "Data is CC BY 4.0; cite as whataifound.org.",
        "",
        "## How entries are graded",
        "",
        "Verification, strongest to weakest. When unsure, the lower grade wins:",
        "",
    ]
    lines += [f"- **{v['label']}**: {v['short']}" for v in VER]
    lines += ["", "Autonomy, most to least AI-driven:", ""]
    lines += [f"- **{a['label']}**: {a['short']}" for a in AUT]
    lines += [
        "",
        "## Core pages",
        "",
        f"- [Registry]({SITE}/): all entries, searchable and filterable",
        f"- [Methodology]({SITE}/methodology): full definitions of both grading scales and the editorial rules",
        f"- [Visuals]({SITE}/visuals): the registry as charts",
        f"- [Open review queue]({SITE}/review): entries still needing an independent check",
        f"- [Contributors]({SITE}/contributors): who builds and checks the registry",
        "",
        "## Data",
        "",
        f"- [entries.json]({SITE}/data/entries.json): the complete registry, one JSON file, CC BY 4.0",
        f"- [RSS]({SITE}/feed.xml) · [JSON Feed]({SITE}/feed.json): new and updated entries",
        "",
        "## Findings",
        "",
    ]
    for field in sorted(by_field, key=lambda k: FIELD_LABEL.get(k, k)):
        lines.append(f"### {FIELD_LABEL.get(field, field)}")
        lines.append("")
        for e in sorted(by_field[field], key=lambda x: x.get("date", ""), reverse=True):
            ver = VER_LABEL.get(e["verification"], e["verification"])
            aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
            lines.append(
                f"- [{e['title']}]({SITE}/finding/{e['id']}): {e['claim']} "
                f"({e.get('lab', '')}, {e.get('model', '')}, {e.get('date', '')}; "
                f"verification: {ver}; autonomy: {aut})")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# ------------------------------------------------------------------ sitemap
def build_sitemap(entries, updated):
    """Build the sitemap with content-derived lastmod dates.

    `lastmod` must come from the data, never from date.today(): the build output is
    committed and CI re-runs it, so a clock-derived value makes the file differ on any
    day other than the one it was built on, failing the drift check for a reason that
    has nothing to do with the content. The registry pages change when an entry is
    added, so the newest `added` date is the honest answer for all three.
    """
    urls = [(SITE + path, updated, freq, pri) for path, _, freq, pri in PAGES]
    for e in sorted(entries, key=lambda x: x.get("date", ""), reverse=True):
        lastmod = (e.get("added") or e.get("date") or updated)[:10]
        urls.append((f"{SITE}/finding/{e['id']}", lastmod, "monthly", "0.8"))
    body = "\n".join(
        f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{m}</lastmod>\n"
        f"    <changefreq>{c}</changefreq>\n    <priority>{p}</priority>\n  </url>"
        for u, m, c, p in urls)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{body}\n</urlset>\n")


# ------------------------------------------------------------------ index.html
def inject(src, start, end, payload, what, where="index.html"):
    """Replace everything between two marker comments. Fails loudly if absent."""
    i, j = src.find(start), src.find(end)
    if i == -1 or j == -1:
        raise SystemExit(f"{where}: missing {what} markers ({start} / {end}). "
                         "Restore them or re-run against a clean checkout.")
    return src[:i + len(start)] + payload + src[j:]


def build_app_js():
    """Write the grade label tables into app.js from data/vocab.json.

    app.js is served to the browser unbundled, so it cannot read the vocabulary at
    load time. Generating the two tables here keeps its copy from drifting from the
    Python one without introducing a module loader or a build step for the client.
    """
    path = os.path.join(ROOT, "app.js")
    with open(path) as f:
        src = f.read()

    def table(name, items):
        rows = ",".join(f"\n  {json.dumps(i['slug'])}:{json.dumps(i['label'])}"
                        for i in items)
        return f"const {name} = {{{rows}\n}};"

    def ranks(name, mapping):
        rows = ",".join(f"\n  {json.dumps(k)}:{v}" for k, v in mapping.items())
        return f"const {name} = {{{rows}\n}};"

    payload = ("\n" + table("VER_LABEL", VER) + "\n" + table("AUT_LABEL", AUT) + "\n"
               + ranks("VER_SCORE", VER_SCORE) + "\n" + ranks("AUT_RANK", AUT_RANK) + "\n")
    src = inject(src, "/*VOCAB:START*/", "/*VOCAB:END*/", payload,
                 "vocabulary tables", "app.js")

    with open(path, "w") as f:
        f.write(src)


def build_review(entries):
    """Regenerate /review: the entries that still need work, weakest evidence first.

    This is the registry's open task list, and it is derived rather than curated so it
    cannot go stale or flatter the project. An entry leaves the queue the moment its gap
    is filled in data/entries.json, with no separate list to remember to update.

    Ordering is by how badly the gap matters, not by date. An entry carrying a weak grade
    with nobody having checked it is the worst case: the grade is doing no work and the
    reader has no way to know that.
    """
    # The queue is about verification, and only verification. Metadata gaps are real but
    # minor, and folding them in put 51 of 52 entries on the page, which reads as "the
    # whole registry is broken" rather than as a task list anyone would pick up. They get
    # a compact section at the bottom instead.
    WEAK = ("claimed", "author-verified", "disputed")

    def rank(e):
        if e["verification"] in WEAK:
            return 0
        return 1

    queue = sorted((e for e in entries if not e.get("independent_checks")),
                   key=lambda e: (rank(e), e["id"]))

    TIER = {0: ("Weakly graded, and nobody has checked it",
                "The grade rests on the announcing lab alone. These matter most."),
            1: ("No independent check yet",
                "Better evidenced, but still unconfirmed by anyone outside the lab.")}

    rows, current = "", None
    for e in queue:
        r = rank(e)
        if r != current:
            current = r
            head, sub = TIER[r]
            n = sum(1 for x in queue if rank(x) == r)
            rows += (f'<div class="q-head"><h2>{esc(head)}</h2>'
                     f'<p>{esc(sub)} <b>{n}</b> {"entry" if n == 1 else "entries"}.</p></div>')
        ver = VER_LABEL.get(e["verification"], e["verification"])
        aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
        check = REPO + "/issues/new?" + "&".join([
            "template=independent-check.yml",
            "title=" + enc_uri_component(f"Independent check: {e['id']}"),
            "entry=" + enc_uri_component(e["id"]),
            "current=" + enc_uri_component(
                f"verification: {e['verification']}, autonomy: {e['autonomy']}"),
        ])
        rows += (
            f'<div class="q-row">'
            f'<div class="q-main">'
            f'<a class="q-title" href="/finding/{esc(e["id"])}">{esc(e["title"])}</a>'
            f'<div class="q-meta"><span class="pill v v-{esc(e["verification"])}">{esc(ver)}</span>'
            f'<span class="pill a">{esc(aut)}</span>'
            f'<span class="q-lab">{esc(e.get("lab"))}</span></div>'
            f'</div>'
            f'<a class="btn q-act" href="{esc(check)}" target="_blank" rel="noopener">'
            f'Check this<span aria-hidden="true"> ↗</span></a>'
            f'</div>')

    # Smaller gaps, listed compactly. These are good first contributions: each is a
    # single verifiable fact, no judgment about evidence required.
    SMALL = [("year_posed", "no year posed",
              "the year the problem was first posed, so the site can show how long it stood"),
             ("wikipedia", "no notability rating",
              "the Wikipedia article for the problem itself, which drives the notability count"),
             ("discussion", "no discussion linked",
              "a thread where the result was debated, such as Hacker News or MathOverflow")]
    small = ""
    for key, label, why in SMALL:
        missing = [e for e in entries if not e.get(key)]
        if not missing:
            continue
        links = " ".join(f'<a href="/finding/{esc(e["id"])}">{esc(e["title"])}</a>'
                         for e in missing[:8])
        more = (f' <span class="c-more">and {len(missing) - 8} more</span>'
                if len(missing) > 8 else "")
        small += (f'<div class="q-small"><h3>{esc(label)} <b>{len(missing)}</b></h3>'
                  f'<p>Needs {esc(why)}.</p><p class="q-small-links">{links}{more}</p></div>')
    if small:
        small = ('<div class="q-head"><h2>Smaller gaps</h2>'
                 '<p>Single verifiable facts rather than judgments about evidence. '
                 'A good first contribution.</p></div>' + small)

    checked = len(entries) - len(queue)
    summary = (f'<p class="q-sum"><b>{len(queue)}</b> of {len(entries)} entries have never been '
               f'independently checked. {checked} '
               f'{"has" if checked == 1 else "have"} at least one check on the record. '
               f'You do not need to reproduce a whole result to help: reading the primary source '
               f'closely enough to say whether it supports the claim is a check, and you are '
               f'credited on the entry and on the '
               f'<a href="/contributors">contributors page</a>.</p>')

    path = os.path.join(ROOT, "review.html")
    src = open(path).read()
    src = inject(src, "<!--BACKLOG:START-->", "<!--BACKLOG:END-->",
                 summary + rows + small, "review queue", "review.html")
    with open(path, "w") as f:
        f.write(src)
    return len(queue)


def build_contributors(entries):
    """Regenerate /contributors from the credit recorded on the entries.

    Maintainers come from CITATION.cff, which is the roster GitHub cites and the one
    GOVERNANCE.md points at, so there is no second list to keep in step.
    """
    def roll(field):
        people = {}
        for e in entries:
            for p in (e.get(field) or []):
                name = p.get("name")
                if not name:
                    continue
                rec = people.setdefault(name, {"name": name, "github": p.get("github"),
                                               "entries": []})
                rec["entries"].append(e)
                if not rec["github"] and p.get("github"):
                    rec["github"] = p["github"]
        return sorted(people.values(), key=lambda r: (-len(r["entries"]), r["name"]))

    def tier(title, blurb, people, verb):
        if not people:
            return ""
        cards = ""
        for r in people:
            links = " ".join(
                f'<a href="/finding/{esc(x["id"])}">{esc(x["title"])}</a>'
                for x in r["entries"][:6])
            more = (f' <span class="c-more">and {len(r["entries"]) - 6} more</span>'
                    if len(r["entries"]) > 6 else "")
            cards += (f'<div class="c-card"><p class="c-name">{person(r)}</p>'
                      f'<p class="c-count">{len(r["entries"])} '
                      f'{"entry" if len(r["entries"]) == 1 else "entries"} {esc(verb)}</p>'
                      f'<p class="c-links">{links}{more}</p></div>')
        return (f'<section class="c-tier"><h2>{esc(title)}</h2><p class="c-blurb">{blurb}</p>'
                f'<div class="c-grid">{cards}</div></section>')

    maintainers = "".join(
        f'<div class="c-card"><p class="c-name">{esc(m)}</p>'
        f'<p class="c-count">maintainer</p></div>' for m in citation_authors())
    out = (f'<section class="c-tier"><h2>Maintainers</h2>'
           f'<p class="c-blurb">Listed as authors in '
           f'<a href="{REPO}/blob/main/CITATION.cff">CITATION.cff</a>, so citing the registry '
           f'cites them. What the role involves, and how someone reaches it, is in '
           f'<a href="{REPO}/blob/main/GOVERNANCE.md">GOVERNANCE.md</a>.</p>'
           f'<div class="c-grid">{maintainers}</div></section>')

    revs, cons = roll("reviewers"), roll("contributors")
    out += tier("Reviewers", "Submitted independent checks that were accepted onto the record.",
                revs, "checked")
    out += tier("Contributors", "Added or corrected entries in the registry.", cons, "credited")

    if not revs and not cons:
        out += ('<p class="c-empty">No outside reviewers or contributors are credited yet. '
                f'The <a href="/review">open review queue</a> is where that starts: pick an entry '
                f'nobody has checked, check it, and your name goes on it.</p>')

    path = os.path.join(ROOT, "contributors.html")
    src = open(path).read()
    src = inject(src, "<!--ROLL:START-->", "<!--ROLL:END-->", out,
                 "contributor roll", "contributors.html")
    with open(path, "w") as f:
        f.write(src)


def citation_authors():
    """Author names from CITATION.cff, without taking a YAML dependency for six lines.

    build.py must run on a bare Python 3, and PyYAML is not otherwise needed, so this
    reads the one list it cares about rather than parsing the whole document.
    """
    path = os.path.join(ROOT, "CITATION.cff")
    if not os.path.exists(path):
        return []
    names, in_authors = [], False
    given = family = None
    for line in open(path):
        if re.match(r"^authors:\s*$", line):
            in_authors = True
            continue
        if in_authors:
            if line.strip() and not line.startswith((" ", "\t", "-")):
                break                       # a new top-level key ends the list
            if re.match(r"^\s*-\s", line):  # flush the previous author
                if given or family:
                    names.append(" ".join(x for x in (given, family) if x))
                given = family = None
            m = re.search(r"given-names:\s*(.+?)\s*$", line)
            if m:
                given = m.group(1).strip('"\'')
            m = re.search(r"family-names:\s*(.+?)\s*$", line)
            if m:
                family = m.group(1).strip('"\'')
    if given or family:
        names.append(" ".join(x for x in (given, family) if x))
    return names


def build_nav():
    """Write the shared nav into every static page, each marking its own entry current."""
    for path, _, _, _ in PAGES:
        name = "index.html" if path == "/" else path.lstrip("/") + ".html"
        full = os.path.join(ROOT, name)
        src = open(full).read()
        src = inject(src, "<!--NAV:START-->", "<!--NAV:END-->", page_nav(path), "site nav", name)
        with open(full, "w") as f:
            f.write(src)


def build_methodology():
    """Regenerate the two grade lists on the methodology page from data/vocab.json.

    The page defines the vocabulary the whole registry is graded against, so it must
    not be able to drift from the tables the site actually renders with. Only the rows
    between the markers are generated; the surrounding prose and the editorial rules
    stay hand-written.
    """
    path = os.path.join(ROOT, "methodology.html")
    with open(path) as f:
        src = f.read()

    ver = "\n      ".join(
        f'<div class="meth-row"><span class="pill v v-{v["slug"]}">{esc(v["label"])}</span>\n'
        f'        <p class="meth-def">{esc(v["definition"])}</p></div>'
        for v in VER)
    aut = "\n      ".join(
        f'<div class="meth-row"><span class="meth-term">{esc(a["label"])}</span>\n'
        f'        <p class="meth-def">{esc(a["definition"])}</p></div>'
        for a in AUT)

    src = inject(src, "<!--VERDEFS:START-->", "<!--VERDEFS:END-->", ver,
                 "verification definitions", "methodology.html")
    src = inject(src, "<!--AUTDEFS:START-->", "<!--AUTDEFS:END-->", aut,
                 "autonomy definitions", "methodology.html")

    with open(path, "w") as f:
        f.write(src)


def build_index(entries, updated):
    path = os.path.join(ROOT, "index.html")
    with open(path) as f:
        src = f.read()

    cards = "\n".join(card(e) for e in entries)
    src = inject(src, "<!--ENTRIES:START-->", "<!--ENTRIES:END-->",
                 "\n" + cards + "\n", "entry list")

    strong = sum(1 for e in entries
                 if e["verification"] in ("formal", "independent", "peer-reviewed"))
    auto = sum(1 for e in entries if e["autonomy"] in ("autonomous", "ai-led"))
    negative = sum(1 for e in entries
                   if e["verification"] in ("known", "disputed", "refuted"))
    stats = [(len(entries), "Entries on record"), (strong, "Well verified"),
             (auto, "AI-led or autonomous"), (negative, "Negative or contested")]
    # Rendered with the final number already in place: app.js re-renders and counts
    # up from 0 on load, but a crawler that never runs it still reads the real figure.
    stats_html = "".join(
        f'<div class="stat"><b data-target="{n}">{n}</b><span>{l}</span></div>'
        for n, l in stats)
    src = inject(src, "<!--STATS:START-->", "<!--STATS:END-->", stats_html, "stats")

    # The hero chart, pre-rendered for the crawlers that never run app.js. No newlines
    # around it: verify-parity.py diffs this region against matrixCard()'s own output.
    src = inject(src, "<!--MATRIX:START-->", "<!--MATRIX:END-->",
                 matrix_card(entries), "hero matrix")

    src = inject(src, "<!--COUNT:START-->", "<!--COUNT:END-->",
                 f"{len(entries)} / {len(entries)} entries", "result count")
    src = inject(src, "<!--UPDATED:START-->", "<!--UPDATED:END-->", updated, "updated date")

    # The "how many are actually verified" FAQ answer quotes these tallies. It lives
    # inside the JSON-LD, where an HTML comment marker would become literal text an
    # answer engine quotes back, so the sentence is rewritten in place by pattern
    # instead, and stays plain prose. Numbers here are asserted as fact to LLMs; a
    # stale one is worse than no answer, so it is derived, not hand-maintained.
    scaffold = sum(1 for e in entries if e["autonomy"] == "search-scaffold")
    faq = (f"Of the {len(entries)} results currently on the whataifound.org register, "
           f"{strong} are well verified (formally verified, independently checked or peer "
           f"reviewed) and {negative} are negative or contested (already known, disputed or "
           f"refuted). Only {auto} are graded AI-led or autonomous; {scaffold} came from "
           f"human-built search scaffolds such as FunSearch and AlphaEvolve, where an LLM "
           f"sits inside a harness a human designed.")
    pattern = re.compile(
        r"Of the \d+ results currently on the whataifound\.org register.*?"
        r"a harness a human designed\.", re.S)
    src, n = pattern.subn(faq.replace("\\", "\\\\"), src, count=1)
    if n != 1:
        raise SystemExit("index.html: could not find the FAQ tally sentence to update. "
                         "If its wording changed, update the pattern in build_index().")

    # Filter <select>s: app.js repopulates these, but a crawler should see the
    # available facets, and a no-JS visitor should not see three empty dropdowns.
    def options(values, labels=None):
        return "".join(f'<option value="{esc(v)}">{esc((labels or {}).get(v, v))}</option>'
                       for v in sorted(set(values)))
    src = inject(src, "<!--FIELDOPTS:START-->", "<!--FIELDOPTS:END-->",
                 options(e["field"] for e in entries), "field options")
    src = inject(src, "<!--LABOPTS:START-->", "<!--LABOPTS:END-->",
                 options(e["lab"] for e in entries), "lab options")
    src = inject(src, "<!--VEROPTS:START-->", "<!--VEROPTS:END-->",
                 options((e["verification"] for e in entries), VER_LABEL), "verification options")

    with open(path, "w") as f:
        f.write(src)


# ------------------------------------------------------------------ main
# Only these schemes may appear in a link the site renders. Everything an entry cites
# is a public web document, so this is not restrictive in practice, but `javascript:`
# and `data:` URLs in a source link become executable hrefs on both the registry page
# and the entry page, and the site's CSP allows 'unsafe-inline', so it would not stop
# them. A contributor sends URLs; a reviewer skimming a large JSON diff can miss one.
SAFE_SCHEMES = ("https://", "http://")


def check_urls(e, where, problems):
    """Every URL an entry contributes to the page must be an ordinary web link."""
    for field in ("sources", "discussion", "independent_checks"):
        for item in (e.get(field) or []):
            url = item.get("url")
            # An independent check need not link anywhere: an in-house recomputation
            # or a blind assessment has no URL. card() already renders no link for a
            # missing or empty value, so absent and "" are both legitimate there.
            if field == "independent_checks" and not url:
                continue
            if not isinstance(url, str) or not url.startswith(SAFE_SCHEMES):
                problems.append(
                    f"{where}: {field} URL {url!r} is not an http(s) link. "
                    "javascript:, data: and other schemes are rejected because they "
                    "become executable links on the page.")
    for v in (e.get("videos") or []):
        # Interpolated into a youtube-nocookie iframe src and a watch?v= link.
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", str(v.get("youtube_id", ""))):
            problems.append(f"{where}: youtube_id {v.get('youtube_id')!r} is not a valid "
                            "11-character YouTube id")
    # Used as a Wikipedia article title by build-notability.py, not as a URL.
    if e.get("wikipedia") is not None and not isinstance(e["wikipedia"], str):
        problems.append(f"{where}: wikipedia must be an article title string")


def validate_vocab():
    """Check data/vocab.json is complete and that every grade can actually render.

    Adding a grade is a code change, not an entry change: a verification slug also
    needs a .v-<slug> pill colour in styles.css. Without one the pill renders unstyled
    and the omission is invisible until someone looks at that grade on the page, so it
    is caught here instead.
    """
    problems = []
    for axis in ("verification", "autonomy"):
        seen = set()
        for i, item in enumerate(VOCAB.get(axis) or []):
            where = f"vocab.json {axis}[{i}]"
            for key in ("slug", "label", "short", "definition"):
                if not item.get(key):
                    problems.append(f"{where}: missing '{key}'")
            slug = item.get("slug")
            if slug in seen:
                problems.append(f"{where}: duplicate slug '{slug}'")
            seen.add(slug)
            if axis == "verification" and not item.get("rating_label"):
                problems.append(f"{where}: missing 'rating_label'")
            if axis == "verification" and not isinstance(item.get("rating"), int):
                problems.append(f"{where}: 'rating' must be an integer 1-5")

    css_path = os.path.join(ROOT, "styles.css")
    if os.path.exists(css_path):
        css = open(css_path).read()
        for v in VER:
            if f".v-{v['slug']}" not in css:
                problems.append(
                    f"vocab.json: verification '{v['slug']}' has no .v-{v['slug']} rule "
                    f"in styles.css, so its pill would render unstyled")

    if problems:
        print(f"data/vocab.json has {len(problems)} problem(s):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        raise SystemExit(1)


def validate(entries):
    """Reject data that would silently produce a broken, unsafe or unreachable page.

    Adding a finding is meant to be "edit data/entries.json, rebuild", so the build
    is the only place a typo can be caught. It fails loudly here rather than emitting
    a page with an empty <h1>, a colliding URL, or a grade nothing knows how to label.

    This is also the security boundary for contributed content. Entry text is escaped
    at render time, but a URL is not text, it is a scheme the browser will act on,
    so the schemes are checked here instead.
    """
    problems = []
    seen = {}
    for n, e in enumerate(entries):
        where = e.get("id") or f"entry #{n} (no id)"
        check_urls(e, where, problems)
        for field in ("id", "title", "claim", "date", "field", "lab",
                      "model", "verification", "autonomy"):
            if not e.get(field):
                problems.append(f"{where}: missing required field '{field}'")
        if e.get("verification") and e["verification"] not in VER_LABEL:
            problems.append(f"{where}: unknown verification '{e['verification']}' "
                            f"(expected one of: {', '.join(VER_LABEL)})")
        if e.get("autonomy") and e["autonomy"] not in AUT_LABEL:
            problems.append(f"{where}: unknown autonomy '{e['autonomy']}' "
                            f"(expected one of: {', '.join(AUT_LABEL)})")
        if e.get("field") and e["field"] not in FIELD_LABEL:
            problems.append(f"{where}: field '{e['field']}' has no display label. "
                            f"add it to FIELD_LABEL in {os.path.basename(__file__)}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(e.get("date", ""))):
            problems.append(f"{where}: date '{e.get('date')}' is not YYYY-MM-DD")
        # Credit for the registry entry, as distinct from credit for the discovery
        # (that is `lab` and `humans`). `name` is the only required part: an academic
        # may want a real name with no GitHub account against it, and a check submitted
        # by someone without an account is still a check.
        for field in ("contributors", "reviewers"):
            people = e.get(field)
            if people is None:
                continue
            if not isinstance(people, list):
                problems.append(f"{where}: '{field}' must be a list of objects")
                continue
            for i, p in enumerate(people):
                if not isinstance(p, dict):
                    problems.append(f"{where}: {field}[{i}] must be an object "
                                    "with at least a 'name'")
                elif not p.get("name"):
                    problems.append(f"{where}: {field}[{i}] is missing 'name'")
                # No url key by design: these render as text and a GitHub handle is
                # turned into a link by the build, so there is no free-form URL to
                # smuggle a scheme through. Reject one rather than silently drop it.
                elif "url" in p:
                    problems.append(f"{where}: {field}[{i}] has a 'url'; use "
                                    "'github' (a handle) instead")
        eid = e.get("id")
        if eid:
            # The id becomes a filename and a URL path segment.
            if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", str(eid)):
                problems.append(f"{where}: id is not URL/filename safe "
                                "(use lowercase letters, digits, '-', '_', '.')")
            if eid in seen:
                problems.append(f"{where}: duplicate id (also at entry #{seen[eid]})")
            seen[eid] = n
    if problems:
        raise SystemExit("data/entries.json has "
                         f"{len(problems)} problem(s):\n  - "
                         + "\n  - ".join(problems))


def main():
    with open(os.path.join(ROOT, "data", "entries.json")) as f:
        entries = json.load(f)

    validate_vocab()
    validate(entries)

    # Same order the site shows: newest discovery first. app.js sorts identically,
    # so the pre-rendered DOM and the hydrated DOM agree.
    entries.sort(key=lambda e: e.get("date", ""), reverse=True)

    updated = (sorted(e["added"] for e in entries if e.get("added"))[-1]
               if any(e.get("added") for e in entries)
               else (entries[0].get("date", "") if entries else ""))
    # Vocabulary-derived files first: card() output depends on the labels, so app.js
    # must be current before verify-parity.py diffs it against the pre-rendered cards.
    build_app_js()
    build_methodology()
    queued = build_review(entries)
    build_contributors(entries)
    # After the page builders, so every shell has been written before the shared nav
    # goes into it. One generated nav, five pages, no hand-maintained copies.
    build_nav()
    build_index(entries, updated)

    out_dir = os.path.join(ROOT, "finding")
    os.makedirs(out_dir, exist_ok=True)
    # Drop pages for entries that no longer exist, so a removed id 404s.
    keep = {f"{e['id']}.html" for e in entries}
    for stale in set(os.listdir(out_dir)) - keep:
        if stale.endswith(".html"):
            os.remove(os.path.join(out_dir, stale))
    for e in entries:
        with open(os.path.join(out_dir, f"{e['id']}.html"), "w") as f:
            f.write(entry_page(e))

    with open(os.path.join(ROOT, "llms.txt"), "w") as f:
        f.write(build_llms_txt(entries))
    with open(os.path.join(ROOT, "sitemap.xml"), "w") as f:
        f.write(build_sitemap(entries, updated))

    print(f"Pre-rendered {len(entries)} entries into index.html")
    print(f"Wrote finding/ ({len(entries)} pages), llms.txt, sitemap.xml "
          f"({build_sitemap(entries, updated).count('<loc>')} URLs).")
    print(f"Review queue: {queued} of {len(entries)} entries need work.")


if __name__ == "__main__":
    main()
