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

# Pages that carry the shared chrome but do not belong in the nav. /account is a
# per-reader surface reached from the header control, and /privacy is a footer link
# rather than a destination, so putting either in the nav would crowd a bar that is
# already tight at 1180px. The flag is whether the page belongs in the sitemap: a
# privacy policy should be indexable, an account dashboard should not.
#   (path, in_sitemap, changefreq, priority)
CHROME_PAGES = [
    ("/privacy", True, "yearly", "0.2"),
    ("/account", False, None, None),
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

# What each source link is: the original work, the claim about it, or the case against.
# Not a grade - see the note in vocab.json. Array order is display order, and it is the
# order the rows appear in on a card, so it reads original work -> claim -> pushback.
SRC = VOCAB["source_kinds"]
SRC_ORDER = [k["slug"] for k in SRC]
SRC_LABEL = {k["slug"]: k["label"] for k in SRC}
SRC_CHIP = {k["slug"]: k["chip"] for k in SRC}

# What each recorded edit to an entry is. Not a grade either: it classifies a change,
# so that editorial rule 2 (never delete; downgrade and annotate) is visible on the
# site rather than only in the git log.
REV = VOCAB["revision_kinds"]
REV_LABEL = {k["slug"]: k["label"] for k in REV}
REV_CHIP = {k["slug"]: k["chip"] for k in REV}
# The build owns `added`: it synthesises one per entry from the `added` field, so it is
# the one kind an entry may not carry itself. Writing it by hand would either duplicate
# that row or backdate it, and neither is visible in a diff of a 3000-line data file.
REV_KIND_BUILD_OWNED = "added"
REV_KINDS_AUTHORABLE = [k["slug"] for k in REV if k["slug"] != REV_KIND_BUILD_OWNED]

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
    # The card face shows this name instead of the link title, so an unmapped host
    # renders as a raw domain there and looks broken. Every host in entries.json
    # needs a line; the build warns when one is missing.
    "science.org": "Science", "biorxiv.org": "bioRxiv", "cell.com": "Cell",
    "pmc.ncbi.nlm.nih.gov": "NIH PMC", "iopscience.iop.org": "IOP",
    "pubs.rsc.org": "Materials Horizons", "blog.google": "Google",
    "microsoft.com": "Microsoft", "nasa.gov": "NASA", "nih.gov": "NIH",
    "news.mit.edu": "MIT News", "ox.ac.uk": "Oxford",
    "engineering.princeton.edu": "Princeton", "sakana.ai": "Sakana AI",
    "arcinstitute.org": "Arc Institute", "bakerlab.org": "Baker Lab",
    "evolutionaryscale.ai": "EvolutionaryScale", "insilico.com": "Insilico",
    "math.inc": "Math Inc.", "flywire.ai": "FlyWire", "scrollprize.org": "Vesuvius Challenge",
    "asimov.press": "Asimov Press", "physicsworld.com": "Physics World",
    "sciencedaily.com": "ScienceDaily", "officechai.com": "OfficeChai",
    "x.com": "X", "scottaaronson.blog": "Scott Aaronson",
    "terrytao.wordpress.com": "Terence Tao", "xenaproject.wordpress.com": "Kevin Buzzard",
    "simonwillison.net": "Simon Willison", "alexisgallagher.com": "Alexis Gallagher",
    "jacobianfun.org": "jacobianfun.org",
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


# --- port of receipts() and groupedRefs() in app.js. Keep the markup identical;
# verify-parity.py diffs the two and fails the build on any drift.
RECEIPT_MAX = 3


def receipts(e):
    """The card face: what each link is, without opening the disclosure."""
    src = e.get("sources") or []
    rows = ""
    for kind in SRC_ORDER:
        of = [s for s in src if s.get("kind") == kind]
        if not of:
            # A missing challenge is the one absence worth stating.
            if kind == "challenge":
                rows += (f'<div class="rc-row"><dt class="rc-k k-{esc(kind)}">{esc(SRC_CHIP[kind])}</dt>'
                         f'<dd class="rc-v rc-none">none linked</dd></div>')
            continue
        # Visible text is the domain; the full title becomes the accessible name and
        # hover text, so two papers from the same host are still tellable apart.
        shown = "".join(
            f'<a class="rc-l" href="{esc(s.get("url"))}" target="_blank" rel="noopener" '
            f'title="{esc(s.get("label"))}" aria-label="{esc(s.get("label"))}">'
            f'{esc(domain_of(s.get("url", "")))}'
            f'<span class="rc-a" aria-hidden="true">↗</span></a>'
            for s in of[:RECEIPT_MAX])
        extra = (f'<span class="rc-more">+{len(of) - RECEIPT_MAX}</span>'
                 if len(of) > RECEIPT_MAX else "")
        rows += (f'<div class="rc-row"><dt class="rc-k k-{esc(kind)}">{esc(SRC_CHIP[kind])}</dt>'
                 f'<dd class="rc-v">{shown}{extra}</dd></div>')
    return f'<dl class="receipts">{rows}</dl>' if rows else ""


def grouped_refs(src):
    """The same links inside the disclosure, grouped and with their full titles."""
    out = ""
    for kind in SRC_ORDER:
        of = [s for s in (src or []) if s.get("kind") == kind]
        if not of:
            continue
        out += (f'<div class="field reveal kind k-{esc(kind)}"><b>{esc(SRC_LABEL[kind])}</b>'
                f'<div class="refs">{"".join(ref_row(s) for s in of)}</div></div>')
    return out


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


# ------------------------------------------------------------------ shared chrome
# The header and footer are generated for the same reason page_nav() is: they were
# hand-written into five files and generated into none, and the copies had already
# drifted. The theme switcher existed on the home page alone, so a reader who followed a
# link to a finding page could not change the theme without going back; the minimal
# footer was copy-pasted across four files, inline GitHub SVG and all.
#
# One definition, used two ways: injected between the HEADER/FOOTER markers in the five
# hand-written pages, and called directly by entry_page(), which writes the 52 finding
# pages from scratch. 404.html is the documented exception and carries its own inlined
# copy, because it is self-contained by design so it still renders if styles.css fails.

# The gradient id has to be unique within a page (a duplicate collides and the second
# mark renders blank), so this is the only place a page gets one.
BRAND_MARK = (
    '<svg class="mark" viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">'
    '<defs><linearGradient id="mk-i" x1="0" y1="0" x2="1" y2="1">'
    '<stop offset="0" stop-color="#5aa9e6"/>'
    '<stop offset="0.5" stop-color="#7c6cf0"/>'
    '<stop offset="1" stop-color="#d98a4a"/>'
    '</linearGradient></defs>'
    '<path class="m1a" d="M2.6 12 L12 2.6 L21.4 12" fill="none" stroke="url(#mk-i)"'
    ' stroke-opacity="0.75" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
    '<path class="m1b" d="M2.6 12 L12 21.4 L21.4 12" fill="none" stroke="currentColor"'
    ' stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
    '<path class="m2" d="M6.9 8.75 L17.1 8.75 L18.35 10.05 L5.65 10.05 Z" fill="url(#mk-i)"'
    ' fill-opacity="0.75"/>'
    '<path class="m3" d="M9.9 11.4 h4.2 v1.1 h-1.35 v4.4 h1.35 v1.1 h-4.2 v-1.1 h1.35 v-4.4'
    ' h-1.35 z" fill="url(#mk-i)"/>'
    '</svg>')

GH_MARK = (
    '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor"'
    ' fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38'
    ' 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52'
    '-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64'
    '-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32'
    '-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27'
    '.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46'
    '.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>')

# Light / System / Dark. Wired by chrome.js, which loads on every page: app.js owns 47 KB
# of filtering and charts and is not on the sub-pages, which is exactly why the switcher
# used to be missing from them.
THEME_SEG = (
    '<span class="theme-seg" role="group" aria-label="Colour theme">'
    '<button type="button" class="th" data-mode="light" aria-label="Light theme"'
    ' aria-pressed="false" title="Light">'
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    ' stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/>'
    '<path d="M12 2.5v2.3M12 19.2v2.3M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.3M19.2 12h2.3'
    'M4.4 19.6l1.6-1.6M18 6l1.6-1.6"/></svg></button>'
    '<button type="button" class="th" data-mode="system" aria-label="System theme"'
    ' aria-pressed="false" title="System">'
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>'
    '</svg></button>'
    '<button type="button" class="th" data-mode="dark" aria-label="Dark theme"'
    ' aria-pressed="false" title="Dark">'
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M20.5 13.3A8 8 0 1 1 10.7 3.5 6.3 6.3 0 0 0 20.5 13.3z"/></svg></button>'
    '</span>')


# Signed out, the account slot is an icon the same 26px as the identicon that replaces
# it, so the masthead is exactly as wide before and after the session resolves and the
# row never reflows. It is an icon rather than a "Sign in" pill because the eyebrow
# already carries the brand, the five-item nav, the GitHub link, a three-button theme
# switcher and the updated stamp: a fourth text control tipped the row onto two lines at
# every width the site supports. The label survives for anyone who needs it, on
# aria-label and title.
SIGNIN_LINK = (
    '<a class="acct-in" href="/api/auth/start" data-signin'
    ' aria-label="Sign in" title="Sign in">'
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"'
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<circle cx="12" cy="8.2" r="3.6"/>'
    '<path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0"/></svg></a>')


def site_header(current, updated, extra_class=""):
    """The eyebrow every page carries: brand, nav, GitHub, theme switcher, updated stamp.

    `current` is the page's path, or None on a finding page, which sits below the nav
    rather than beside it. `extra_class` carries the home page's intro animation hooks.
    """
    cls = ("eyebrow " + extra_class).strip()
    return (
        f'<div class="{esc(cls)}">'
        f'<a class="brand" href="/" aria-label="whataifound.org home">{BRAND_MARK}'
        f'<span class="wm">what<span class="ai">ai</span>found.org</span></a>'
        f'{page_nav(current)}'
        f'<span class="eyebrow-right">'
        f'<a class="gh-icon" href="{REPO}" target="_blank" rel="noopener"'
        f' aria-label="Source code on GitHub" title="Source on GitHub">{GH_MARK}</a>'
        f'{THEME_SEG}'
        # Pre-rendered in the signed-out state, which is what a crawler and a reader
        # with no session both see. chrome.js replaces the inner markup once /api/me
        # answers; the outer span keeps its size either way, so the row does not jump
        # when the session resolves. `return_to` is filled in by chrome.js from the
        # current URL, so signing in from a finding page comes back to that page.
        f'<span class="acct" data-acct>{SIGNIN_LINK}</span>'
        f'<span class="updated"><span class="pulse"></span>Updated '
        f'<b id="updated">{esc(updated)}</b></span>'
        f'</span></div>')


def site_footer():
    """One footer on every page.

    Every cell is a site-level statement (editorial policy, the licence, how to help, the
    source), so there is no page for which a reduced version would be more honest. It
    costs about 3 KB, which is the right trade on a leaf page that until now offered no
    way back into the site at all.
    """
    return (
        '<footer id="about">'
        '<div class="about-grid">'
        '<section class="about-cell">'
        '<h2 class="lbl">Editorial policy</h2>'
        '<p>Announcements enter as <em>claimed</em>, however confident they sound. Nothing is '
        'ever deleted: entries are downgraded and annotated, and the history stays public. '
        'Every entry carries a novelty check, including when it comes back clean.</p>'
        '<p class="about-links"><a href="/methodology">Full rules →</a></p>'
        '</section>'
        '<section class="about-cell">'
        '<h2 class="lbl">Use the data</h2>'
        '<p>The whole registry is one open file under '
        '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank"'
        ' rel="noopener license">CC&nbsp;BY&nbsp;4.0</a> and can be reused anywhere with '
        'attribution.</p>'
        '<p class="about-links"><a href="/data/entries.json" download>Download JSON</a>'
        '<a href="/feed.xml">RSS</a><a href="/feed.json">JSON Feed</a>'
        f'<a href="{SITE}/LICENSE">License</a></p>'
        '</section>'
        '<section class="about-cell">'
        '<h2 class="lbl">Contribute</h2>'
        '<p>Most entries have never been checked outside the lab that announced them. A check '
        'takes one click to submit, and is credited on the entry and on the contributors '
        'page.</p>'
        '<p class="about-links"><a href="/review">Review queue →</a>'
        '<a href="/contributors">Contributors</a>'
        f'<a href="{REPO}/blob/main/GOVERNANCE.md" target="_blank" rel="noopener">Roles</a></p>'
        '</section>'
        '<section class="about-cell">'
        '<h2 class="lbl">Source</h2>'
        '<p>Site and registry are open on GitHub. Corrections and new entries are welcome by '
        'pull request.</p>'
        '<p class="about-links">'
        f'<a class="gh-link" href="{REPO}" target="_blank" rel="noopener">{GH_MARK}'
        'Repository</a>'
        '<a href="mailto:misik6@gatech.edu?subject=whataifound.org%20feedback"'
        ' title="Submit a finding, suggest a correction, or ask for updates">Send feedback</a>'
        '</p></section>'
        '</div>'
        '<section class="about-note">'
        '<h2 class="lbl">Disclaimer</h2>'
        '<p>We run whataifound.org as an independent editorial project, as volunteer work. '
        'Verification and autonomy grades are our good-faith judgments from public '
        'information, provided "as is" without warranty, and may change as new evidence '
        'emerges. Nothing here is scientific, legal, or investment advice. We are not '
        'affiliated with, sponsored by, or endorsed by any laboratory or company mentioned; '
        'logos and names are trademarks of their owners and appear for identification only. '
        '<a href="mailto:misik6@gatech.edu">Get in touch</a></p>'
        '</section>'
        '<div class="about-foot">'
        '<p class="cite">whataifound.org (2026). <em>whataifound.org: A Registry of AI '
        'Scientific and Mathematical Discoveries.</em> Retrieved '
        f'<span id="cite-date">2026</span> from {SITE}/</p>'
        '<p class="colophon">© 2026 Isik &amp; Co.</p>'
        '</div>'
        '</footer>')


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
            + "".join(f'<a class="tag-chip" href="/?tag={enc_uri_component(t)}">{esc(t)}</a>'
                      for t in e["tags"])
            + "</div>") if e.get("tags") else ""
    detail = f'<p class="detail">{esc(e["detail"])}</p>' if e.get("detail") else ""
    checks_block = (f'<div class="field checks reveal"><b>Independent checks</b>{checks}</div>'
                    if checks else "")
    sources_block = grouped_refs(e.get("sources"))
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
        <span class="pill a a-{esc(e["autonomy"])}">{esc(AUT_LABEL.get(e["autonomy"], e["autonomy"]))}</span>
      </div>
      <dl class="rmeta">
        <div><dt>Model</dt><dd>{esc(e.get("model"))}</dd></div>
        <div><dt>Field</dt><dd>{esc(e.get("field"))}</dd></div>
        {open_meta(e)}
      </dl>
    </div>
    <div class="body">
      <h2><a class="entry-link" href="/finding/{esc(e["id"])}">{esc(e["title"])}</a><a class="permalink" href="#e-{esc(e["id"])}" data-permalink="e-{esc(e["id"])}" aria-label="Copy link to this entry" title="Copy link to this entry">#</a></h2>
      <p class="claim">{esc(e["claim"])}</p>
      {detail}
      {humans}
      {tags}
      {receipts(e)}
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


# ------------------------------------------------------------------ table view
# A hand-port of tableView() in app.js, byte for byte, and the third pair verify-parity.py
# guards. Both layouts are pre-rendered into #list and CSS shows one, because the table is
# the default view: rendering it client-side instead would mean either a visible swap from
# cards to table on every load, or putting the 143 KB of registry JSON back on the critical
# path to avoid one. Pre-rendering both costs about 18 KB and avoids both.
TABLE_COLS = [
    {"label": "Date", "sort": "date-desc", "alt": "date-asc"},
    {"label": "Finding", "sort": "title"},
    {"label": "Lab", "sort": "lab"},
    {"label": "Model"},
    {"label": "Verification", "sort": "evidence"},
    {"label": "Autonomy", "sort": "autonomy"},
    {"label": "Field"},
]


def table_view(entries, sort="date-desc"):
    """Port of tableView() in app.js. Output must match it character for character."""
    head = ""
    for c in TABLE_COLS:
        if not c.get("sort"):
            head += f'<th scope="col">{c["label"]}</th>'
            continue
        active = sort == c["sort"] or (c.get("alt") and sort == c.get("alt"))
        nxt = c["alt"] if (c.get("alt") and sort == c["sort"]) else c["sort"]
        direction = "none" if not active else ("ascending" if sort == "date-asc" else "descending")
        head += (f'<th scope="col" aria-sort="{direction}"><button type="button" class="th-sort'
                 f'{" on" if active else ""}" data-sort="{nxt}">{c["label"]}</button></th>')
    rows = "".join(
        f'''<tr>
      <td class="t-date">{esc(e.get("date"))}</td>
      <td class="t-title"><a href="/finding/{esc(e["id"])}">{esc(e["title"])}</a></td>
      <td title="{esc(e.get("lab"))}">{esc(e.get("lab"))}</td>
      <td title="{esc(e.get("model"))}">{esc(e.get("model"))}</td>
      <td><span class="pill v v-{esc(e["verification"])}">{esc(VER_LABEL.get(e["verification"], e["verification"]))}</span></td>
      <td><span class="pill a a-{esc(e["autonomy"])}">{esc(AUT_LABEL.get(e["autonomy"], e["autonomy"]))}</span></td>
      <td title="{esc(e.get("field"))}">{esc(e.get("field"))}</td>
    </tr>'''
        for e in entries)
    cols = "".join(f'<col class="c-{c}">'
                   for c in ["date", "title", "lab", "model", "ver", "aut", "field"])
    return (f'<div class="tablewrap"><table class="regtable">\n'
            f'    <caption class="vh">All findings in the registry, sortable by column.</caption>\n'
            f'    <colgroup>{cols}</colgroup>\n'
            f'    <thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>')


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


# ------------------------------------------------------- chart builders (ported)
# Ports of hbarsHtml(), yearCard() and topicCard() in app.js, which owns the copies
# /visuals mounts. Both implementations render the same two cards on two pages of the
# same site, so verify-parity.py diffs them the way it already does for matrixCard().


def js_round(x):
    """JS Math.round: ties go up, where Python's round() goes to even.

    round(0.5) is 0 in Python and 1 in JS, and a bar width one percent out is a parity
    failure. Every value here is a non-negative ratio, so floor(x + 0.5) is exactly the
    spec definition over the range that can actually occur.
    """
    return math.floor(x + 0.5)


# Chart labels for the `field` slugs, duplicated from FIELD_SHORT in app.js for the same
# reason DOMAIN_NAME is: the chart is rendered by both, so both need the table. These are
# deliberately NOT vocab.json's `fields` names, which are the prose forms used on the
# methodology page and in llms.txt: a 138px label column cannot hold "Materials science".
# Adding a field means adding it to both files; verify-parity.py fails if they disagree.
FIELD_SHORT = {
    "mathematics": "Mathematics", "computer-science": "Computer science",
    "biology": "Biology", "materials": "Materials", "physics": "Physics",
    "chemistry": "Chemistry", "medicine": "Medicine", "neuroscience": "Neuroscience",
    "astronomy": "Astronomy", "archaeology": "Archaeology", "engineering": "Engineering",
    "climate": "Climate", "economics": "Economics",
}


def hbars_html(rows, name):
    """Port of app.js hbarsHtml(). Rows are (label, count, swatch, title, cls)."""
    rows = [tuple(r) + (None,) * (5 - len(r)) for r in rows]
    top = max([r[1] for r in rows] + [1])
    label = name + ". " + "; ".join(f"{l}: {c}" for l, c, _, _, _ in rows)
    out = f'<div class="hbars" role="img" aria-label="{esc(label)}">'
    for l, c, sw, tt, cls in rows:
        swatch = f'<i class="sw" style="background:{sw}"></i>' if sw else ""
        out += (f'<div class="hbar{" " + cls if cls else ""}"'
                f' title="{esc(tt or f"{l}: {c}")}">'
                f'<span class="hbar-label">{swatch}{esc(l)}</span>'
                f'<span class="hbar-track"><span class="hbar-fill"'
                f' style="width:{js_round(c / top * 100)}%"></span></span>'
                f'<span class="hbar-val">{c}</span></div>')
    return out + "</div>"


def year_card(entries):
    """Port of app.js yearCard(). Findings per year, empty years drawn not skipped."""
    years = [int(e["date"][:4]) for e in entries]
    by_year = [(y, years.count(y)) for y in range(min(years), max(years) + 1)]
    ymax = max([c for _, c in by_year] + [1])
    label = "Findings per year. " + "; ".join(f"{y}: {c}" for y, c in by_year)
    bars = f'<div class="vbars" role="img" aria-label="{esc(label)}">'
    for y, c in by_year:
        bars += (f'<div class="vbar" title="{y}: {c} finding{"" if c == 1 else "s"}">'
                 f'<span class="vbar-val">{c}</span>'
                 f'<span class="vbar-fill"'
                 f' style="height:{max(js_round(c / ymax * 72), 2)}px"></span>'
                 f'<span class="vbar-x">\'{str(y)[2:]}</span></div>')
    bars += "</div>"
    return ('<div class="qv-card"><h3 class="qv-title">Findings per year</h3>'
            + bars + "</div>")


def topic_card(entries, cap=0, cls=""):
    """Port of app.js topicCard(). `cap` is a height budget, not a ranking.

    The tail aggregates into one labelled row rather than being dropped, so the column
    still sums to the registry. /visuals passes 0 and gets every topic; the home page
    passes a cap, because the card is a quarter of the width there.
    """
    counts = {}
    for e in entries:
        if e.get("field") is not None:
            counts[e["field"]] = counts.get(e["field"], 0) + 1
    # Stable sort on count descending, so ties keep first-appearance order, which is
    # what Array.prototype.sort gives app.js over the same entry order.
    rows = [(FIELD_SHORT.get(f, f), c)
            for f, c in sorted(counts.items(), key=lambda kv: -kv[1])]
    head = rows[:cap - 1] if cap and len(rows) > cap else rows
    rest = rows[len(head):]
    out = list(head)
    if rest:
        out.append((f"+{len(rest)} more topics", sum(c for _, c in rest), None,
                    f"{len(rest)} further topics: "
                    + ", ".join(f"{l} ({c})" for l, c in rest), "is-rollup"))
    return (f'<div class="qv-card{" " + cls if cls else ""}">'
            '<h3 class="qv-title">By topic area</h3>'
            + hbars_html(out, "By topic area") + "</div>")


def years_open(e):
    """Port of app.js yearsOpen(). How long the problem stood, derived, never stored."""
    if e.get("year_posed") is None:
        return None
    n = int(str(e["date"])[:4]) - e["year_posed"]
    return n if n >= 0 else None


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
            # Where the claim was *made*, which is what schema.org means by appearance:
            # the announcement and the reporting of it. A rebuttal is not an appearance
            # of the claim, and listing one here told an answer engine the opposite.
            "appearance": [{"@type": "CreativeWork", "url": s["url"]}
                           for s in (e.get("sources") or [])
                           if s.get("url") and s.get("kind") in ("announcement", "coverage")],
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


def bibtex_key(e):
    """A stable, conventional citation key: firstauthorless, so lab-year-slug."""
    org = re.sub(r"[^a-z0-9]+", "", hub_org(e.get("lab") or "").lower()) or "whataifound"
    return f"whataifound-{org}-{str(e.get('date', ''))[:4]}-{e['id'].split('-')[-1]}"


def citation_block(e, url):
    """The prose citation, plus BibTeX and APA, each copyable in one click.

    The registry exists to be cited, and until now the only citation on a finding page
    was a sentence to select by hand. The <pre> blocks are the source of truth and stay
    selectable, so with JavaScript off this degrades to exactly what was here before;
    entry.js only adds the buttons.
    """
    year = str(e.get("date", ""))[:4]
    title = e["title"]
    lab = e.get("lab") or "Independent"
    site = "whataifound.org: A Registry of AI Scientific and Mathematical Discoveries"

    bib = (f"@misc{{{bibtex_key(e)},\n"
           f"  title        = {{{title}}},\n"
           f"  author       = {{{{whataifound.org}}}},\n"
           f"  year         = {{{year}}},\n"
           f"  howpublished = {{{site}}},\n"
           f"  note         = {{Result by {lab}. Verification: "
           f"{VER_LABEL.get(e['verification'], e['verification'])}. Autonomy: "
           f"{AUT_LABEL.get(e['autonomy'], e['autonomy'])}.}},\n"
           f"  url          = {{{url}}}\n"
           f"}}")
    apa = f"whataifound.org. ({year}). {title}. {site}. {url}"

    def block(label, text, lang=""):
        return (f'    <div class="cite-block">\n'
                f'      <div class="cite-head"><span class="cite-label">{esc(label)}</span>'
                f'<button type="button" class="cite-copy" data-copy>Copy</button></div>\n'
                f'      <pre class="cite-pre"{lang}><code>{esc(text)}</code></pre>\n'
                f'    </div>')

    return ('  <h2 class="lbl">Cite this entry</h2>\n'
            '  <div class="cites">\n'
            + block("Plain text", apa) + "\n"
            + block("BibTeX", bib) + "\n"
            + '  </div>')


def related(e, entries):
    """Up to three other findings, ranked by shared tags then by field.

    Every finding page was a dead end: 52 leaf pages with no route to a 53rd. These are
    computed at build time from the data, so there is no list to maintain and no way for
    them to point at an entry that no longer exists.
    """
    tags = set(e.get("tags") or [])
    scored = []
    for o in entries:
        if o["id"] == e["id"]:
            continue
        shared = len(tags & set(o.get("tags") or []))
        same_field = 1 if o.get("field") == e.get("field") else 0
        if not shared and not same_field:
            continue
        # Sorted by shared tags, then same field, then recency, so the tie-break chain
        # is total and the output is stable across rebuilds.
        scored.append((-shared, -same_field, str(o.get("date", "")), o))
    scored.sort(key=lambda t: (t[0], t[1], [-ord(c) for c in t[2]]))
    return [t[3] for t in scored[:3]]


def entry_nav(e, entries):
    """Previous, next and related, rendered as one block at the foot of the page."""
    i = next((n for n, o in enumerate(entries) if o["id"] == e["id"]), None)
    if i is None:
        return "", ""
    # entries is newest-first, so the *next* one chronologically is the previous index.
    newer = entries[i - 1] if i > 0 else None
    older = entries[i + 1] if i + 1 < len(entries) else None

    def step(o, label, arrow_left):
        if not o:
            return '<span class="pn-step pn-empty"></span>'
        arrow = ('<span class="pn-arrow" aria-hidden="true">←</span>' if arrow_left else "")
        after = ('<span class="pn-arrow" aria-hidden="true">→</span>' if not arrow_left else "")
        return (f'<a class="pn-step" href="/finding/{esc(o["id"])}">'
                f'<span class="pn-dir">{arrow}{esc(label)}{after}</span>'
                f'<span class="pn-title">{esc(o["title"])}</span></a>')

    rel = related(e, entries)
    rel_html = ""
    if rel:
        cards = "".join(
            f'<a class="rel-card" href="/finding/{esc(o["id"])}">'
            f'<span class="rel-grade pill v v-{esc(o["verification"])}">'
            f'{esc(VER_LABEL.get(o["verification"], o["verification"]))}</span>'
            f'<span class="rel-title">{esc(o["title"])}</span>'
            f'<span class="rel-meta">{esc(o.get("lab"))} · {esc(o.get("date"))}</span></a>'
            for o in rel)
        rel_html = (f'\n  <h2 class="lbl">Related findings</h2>\n'
                    f'  <div class="relgrid">{cards}</div>')

    nav = (f'\n  <nav class="pagenav-steps" aria-label="Nearby findings">'
           f'{step(older, "Older", True)}{step(newer, "Newer", False)}</nav>')
    # rel="prev"/"next" for crawlers, matching the visible links.
    head = ""
    if older:
        head += f'\n<link rel="prev" href="{SITE}/finding/{older["id"]}">'
    if newer:
        head += f'\n<link rel="next" href="{SITE}/finding/{newer["id"]}">'
    return rel_html + nav, head


# ------------------------------------------------------------------ entry pages
def entry_page(e, entries, updated):
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
    nav_html, nav_head = entry_nav(e, entries)

    # Challenging a grade should cost a reader one click, not a fork. The GitHub issue form
    # prefills from query parameters keyed on each field's id, so the entry and its current
    # grades arrive filled in and the reporter only supplies the citation. esc() escapes the
    # & separators, which an href requires.
    credit = credit_block(e)
    grades = f"verification: {e['verification']}, autonomy: {e['autonomy']}"

    def issue_url(template, title, *extra):
        return REPO + "/issues/new?" + "&".join([
            f"template={template}",
            "title=" + enc_uri_component(title),
            "entry=" + enc_uri_component(e["id"]),
            *extra,
        ])

    # Only the challenge form has a `current` field: it argues against a specific pair of
    # grades, so the pair it was filed against is worth freezing. A check is about the
    # result, not the grade, and a prefilled field nobody edits is just one more row.
    challenge = issue_url("grade-challenge.yml", f"Grade challenge: {e['id']}",
                          "current=" + enc_uri_component(grades))
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
        ask_title = "Nobody outside the lab has checked this yet."
        ask_body = ("Reading the primary source closely enough to say whether it supports the "
                    "claim counts as a check, and you are credited on the entry.")
    else:
        ask_title = "Disagree with these grades?"
        ask_body = ("Entries are never deleted. A grade that does not hold up is downgraded on "
                    "the record, with the objection beside it. Bring a citation.")

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
    fact_rows = "\n".join(
        f"      <div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>"
        for k, v in facts if v)

    def section(title, body):
        return f'\n  <h2 class="lbl">{esc(title)}</h2>\n  <p>{esc(body)}</p>' if body else ""

    # Grouped by what each link is, and uncapped: the finding page is the citable
    # record, so it shows every source rather than the card's first three per kind.
    sources = ""
    for kind in SRC_ORDER:
        of = [s for s in (e.get("sources") or []) if s.get("kind") == kind]
        if not of:
            continue
        sources += (f'\n  <h2 class="lbl kind k-{esc(kind)}">{esc(SRC_LABEL[kind])}</h2>\n  <div class="refs">'
                    + "".join(ref_row(s) for s in of) + "</div>")
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
<meta name="color-scheme" content="dark light">

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
<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="whataifound.org (RSS)">{nav_head}

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

<header>{site_header(None, updated)}</header>
<nav class="crumb" aria-label="Breadcrumb">
  <a href="/">whataifound.org</a> <span aria-hidden="true">/</span>
  <a href="/#e-{esc(e["id"])}">{esc(FIELD_LABEL.get(e.get("field"), e.get("field")))}</a>
  <span aria-hidden="true">/</span> <span>Finding</span>
</nav>

<article class="finding">
  <div class="finding-pills">
    <span class="pill v v-{esc(e["verification"])}">{esc(ver)}</span>
    <span class="pill a a-{esc(e["autonomy"])}">{esc(aut)}</span>
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
  <p>Every entry carries two grades: <strong>verification</strong> (how solid the result is) and
  <strong>autonomy</strong> (how much the AI did). This one is <strong>{esc(ver.lower())}</strong>
  and <strong>{esc(aut.lower())}</strong>. Definitions are in the
  <a href="/methodology">methodology</a>.</p>

{credit}
{citation_block(e, url)}
{nav_html}

  <p class="finding-back"><a href="/#e-{esc(e["id"])}">← All {esc(FIELD_LABEL.get(e.get("field"), e.get("field")))
  .lower()} findings in the registry</a></p>
</article>

{site_footer()}
</div>
<script src="/chrome.js" defer></script>
<script src="/entry.js" defer></script>
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
    urls += [(SITE + path, updated, freq, pri)
             for path, listed, freq, pri in CHROME_PAGES if listed]
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

    def chips(name, items):
        rows = ",".join(f"\n  {json.dumps(i['slug'])}:{json.dumps(i['chip'])}"
                        for i in items)
        return f"const {name} = {{{rows}\n}};"

    payload = ("\n" + table("VER_LABEL", VER) + "\n" + table("AUT_LABEL", AUT) + "\n"
               + ranks("VER_SCORE", VER_SCORE) + "\n" + ranks("AUT_RANK", AUT_RANK) + "\n"
               # card() needs both forms: `chip` for the narrow card-face column and
               # `label` for the group headings inside the disclosure.
               + table("SRC_LABEL", SRC) + "\n" + chips("SRC_CHIP", SRC) + "\n"
               + f"const SRC_ORDER = {json.dumps(SRC_ORDER)};\n")
    src = inject(src, "/*VOCAB:START*/", "/*VOCAB:END*/", payload,
                 "vocabulary tables", "app.js")

    with open(path, "w") as f:
        f.write(src)


# Where each organisation posts its own results. A URL cannot be derived from the data, so this
# map is curated - but *which* organisations appear is not: build_lab_hub() reads that from
# data/entries.json, so the hub cannot drift from the registry the way the hand-written one did
# (it advertised Amazon and Meta, neither of which has ever had an entry).
LAB_HUB = {
    "Google DeepMind": "https://deepmind.google/science/",
    "OpenAI": "https://openai.com/research/index/",
    "Anthropic": "https://www.anthropic.com/science",
    "Google": "https://research.google/",
    "Microsoft Research": "https://www.microsoft.com/en-us/research/",
    "Sakana AI": "https://sakana.ai/blog/",
    "Arc Institute": "https://arcinstitute.org/news",
    "EvolutionaryScale": "https://www.evolutionaryscale.ai/",
    "Insilico Medicine": "https://insilico.com/news",
    "FutureHouse": "https://www.futurehouse.org/",
    "Harmonic": "https://harmonic.fun/",
    "Math, Inc.": "https://math.inc/",
    "Vesuvius Challenge": "https://scrollprize.org/",
    "Institute for Protein Design": "https://www.ipd.uw.edu/",
    "MIT": "https://news.mit.edu/topic/artificial-intelligence2",
    "Carnegie Mellon University": "https://www.cmu.edu/news/",
    "Princeton University": "https://www.pppl.gov/",
    "Lawrence Berkeley National Laboratory": "https://www.lbl.gov/",
    "Tel Aviv University": "https://english.tau.ac.il/",
    "UT Austin": "https://cs.utexas.edu/",
    "FlyWire Consortium": "https://flywire.ai/",
}
# `lab` is deliberately precise about who did the work, so one organisation appears under several
# strings ("Google DeepMind", "... / Isomorphic Labs", "... (with Oxford and Sydney)"). Group on
# the leading organisation for the hub only; the entry keeps its full attribution.
LAB_ALIAS = {
    "Google Brain": "Google",
    "Institute for Protein Design, University of Washington": "Institute for Protein Design",
}
# Not an organisation with a research hub: an entry credited to nobody in particular.
LAB_HUB_SKIP = {"Independent"}


def hub_org(lab):
    stem = (lab or "").split(" / ")[0].split(" (")[0].strip()
    return LAB_ALIAS.get(lab, LAB_ALIAS.get(stem, stem))


def hub_mark(org):
    """The chip on a hub card: the real logo when there is one, else initials.

    Not lab_mark(): that takes a single first letter, which gives Microsoft Research, MIT and
    Math, Inc. three identical chips. Two initials plus a hue derived from the name keeps them
    apart without committing new third-party logo files. Decorative, so aria-hidden.
    """
    src = LAB_LOGO.get(org)
    if src:
        return (f'<span class="labcard-logo" aria-hidden="true">'
                f'<img src="{esc(src)}" alt=""></span>')
    # Skip connector words, or "Institute for Protein Design" initials to "IF".
    words = [w for w in re.split(r"[^A-Za-z0-9]+", org)
             if w and w.lower() not in ("for", "of", "and", "the", "at")]
    first = words[0][:1]
    second = words[1][:1] if len(words) > 1 else words[0][1:2]
    hue = sum(ord(c) for c in org) % 360
    return (f'<span class="labcard-logo mono" style="--lc:hsl({hue} 40% 36%)" aria-hidden="true">'
            f'{esc((first + second).upper())}</span>')


def build_lab_hub(entries):
    """Regenerate the lab row of the #sources hub from the registry itself."""
    counts = {}
    for e in entries:
        org = hub_org(e.get("lab"))
        if org in LAB_HUB_SKIP:
            continue
        counts[org] = counts.get(org, 0) + 1

    missing = sorted(o for o in counts if o not in LAB_HUB)
    if missing:
        # Warn rather than fail: a new entry from an unlisted university should not break the
        # build, but the map must not silently fall behind either.
        print(f"  note: no hub URL for {', '.join(missing)} "
              f"(add to LAB_HUB in {os.path.basename(__file__)})")

    cards = ""
    for org in sorted(counts, key=lambda o: (-counts[o], o)):
        url = LAB_HUB.get(org)
        if not url:
            continue
        n = counts[org]
        cards += (
            f'<a class="labcard" href="{esc(url)}" target="_blank" rel="noopener">'
            f'{hub_mark(org)}'
            f'<span class="labcard-meta"><b>{esc(org)}</b>'
            f'<span>{n} {"entry" if n == 1 else "entries"}</span></span>'
            f'<span class="labcard-go" aria-hidden="true">↗</span></a>')
    return cards


# How many feed rows the hero column holds. The chart beside it is a fixed 392px and the
# two columns are height-matched, so this is a layout budget rather than an editorial
# choice: raising it makes the feed scroll inside a hero that is meant to end above the
# fold. Tune it against the rendered column, not in the abstract.
ACTIVITY_ROWS = 7

# How many topic rows the home page's copy of that chart shows before the tail rolls up,
# and how many entries the longest-standing card lists. Both are width budgets: these
# cards are a quarter of a 1120px row here, against half a page on /visuals. Named
# because verify-parity.py has to pass the same cap to app.js's topicCard().
TOPIC_ROWS = 6
STANDING_ROWS = 4


def build_activity(entries):
    """The activity feed in the hero: what has changed in the registry, newest first.

    Two sources, merged. Every entry contributes one synthesised `added` event, so the
    feed is never empty. On top of that sit the `revisions` an entry records by hand,
    which is where a regrade or a landed check shows up. That second half is the point:
    editorial rule 2 says an entry is downgraded and annotated rather than deleted, and
    until now that promise was only observable in the git log.

    Dates are absolute, never relative. build-site.py imports no clock (see the note at
    the top of this file): the output is committed and CI rebuilds it and diffs the
    bytes, so "3 days ago" would rot the moment nobody touched the registry for a week.
    """
    events = []
    for e in entries:
        for r in (e.get("revisions") or []):
            events.append((r["date"], r["kind"], r.get("note", ""), r.get("url"), e))
        if e.get("added"):
            events.append((e["added"], REV_KIND_BUILD_OWNED,
                           f'Graded {VER_LABEL.get(e["verification"], e["verification"])} '
                           f'and {AUT_LABEL.get(e["autonomy"], e["autonomy"])}.', None, e))

    # The tiebreak is load-bearing, not cosmetic. 25 entries share a single `added` date,
    # so ordering by date alone leaves 25 rows in whatever order dict iteration produced;
    # CI rebuilds this file and fails on any diff, so an unstable sort would break the
    # build on an unrelated pull request. Newest edit, then newest result, then id.
    events.sort(key=lambda ev: (ev[0], ev[4].get("date", ""), ev[4].get("id", "")),
                reverse=True)

    rows = ""
    for date, kind, note, url, e in events[:ACTIVITY_ROWS]:
        link = (f'<a class="feed-src" href="{esc(url)}" target="_blank" rel="noopener"'
                f' aria-label="What prompted this edit">↗</a>') if url else ""
        rows += (
            f'<li class="feed-row">'
            f'<span class="feed-meta">'
            f'<time class="feed-date" datetime="{esc(date)}">{esc(date)}</time>'
            f'<span class="pill r r-{esc(kind)}">{esc(REV_CHIP.get(kind, kind))}</span>'
            f'</span>'
            # Both lines are clipped to one line each by CSS, so the full text is carried
            # on title=. The link text itself is complete, so a screen reader already
            # reads all of it; this is for the pointer.
            f'<a class="feed-title" href="/finding/{esc(e["id"])}"'
            f' title="{esc(e["title"])}">{esc(e["title"])}</a>'
            f'<span class="feed-note" title="{esc(note)}">{esc(note)}{link}</span>'
            f'</li>')

    # The review queue used to have its own tile in this column. It is a truer footer for
    # the feed than a standalone prompt was: the feed says what has been done, and this
    # says what is outstanding. Drops to nothing the day every entry has been checked.
    unchecked = sum(1 for e in entries if not e.get("independent_checks"))
    foot = ""
    if unchecked:
        foot = (f'<a class="feed-foot" href="/review"><b>{unchecked}</b> of {len(entries)} '
                f'entries have never been independently checked.'
                f'<span class="feed-foot-cta">Open the review queue'
                f'<span aria-hidden="true"> →</span></span></a>')

    return (f'<h2 class="feed-head">Latest activity</h2>'
            f'<ol class="feed-list">{rows}</ol>{foot}')


def build_reports(entries):
    """The four small cards between the hero and the registry, one per marker.

    Returns them separately rather than concatenated because the last two are ports of
    charts app.js owns for /visuals, and verify-parity.py diffs the bytes between a pair
    of markers. Pre-rendered like everything else on this page: the crawlers robots.txt
    invites do not run JavaScript.
    """
    n = len(entries)

    # 1. Evidence chain. The registry's whole thesis is that a result and the claim made
    # about it are different things, and `kind` is what encodes that per link. Counted
    # per entry rather than per link: "how many findings have an original work behind
    # them" is the question, and one paper cited twice is not two papers.
    per_kind = {k: 0 for k in SRC_ORDER}
    for e in entries:
        for kind in {s.get("kind") for s in (e.get("sources") or [])}:
            if kind in per_kind:
                per_kind[kind] += 1
    # Scaled to the registry, not to the tallest row, which is what hbars_html does and is
    # right for a ranking. This is coverage: a bar is the share of entries that have that
    # kind of link at all, so 48 of 52 has to read as nearly full and 8 of 52 as nearly
    # empty. Max-scaling would draw the first at 100% and the second at 17%, which states
    # the wrong thing about both. Same markup and classes, so it still looks like the
    # charts beside it. Rows follow vocabulary order (original work, claim, pushback),
    # not count order, because that sequence is the point the card is making.
    # Rows use the short `chip` form, not `label`: the label column is 86px in this strip
    # and "Independent commentary" ellipsises to "Independent co...". The long form stays
    # in the tooltip and in the aria-label, so nothing is lost to a reader or a screen
    # reader, only to the visible column that cannot hold it.
    label = ("Entries linking each kind of source, out of " + str(n) + ". "
             + "; ".join(f"{SRC_LABEL[k]}: {per_kind[k]}" for k in SRC_ORDER))
    bars = f'<div class="hbars" role="img" aria-label="{esc(label)}">'
    for k in SRC_ORDER:
        c = per_kind[k]
        bars += (f'<div class="hbar" title="{esc(SRC_LABEL[k])}: {c} of {n} entries">'
                 f'<span class="hbar-label">'
                 f'<i class="sw" style="background:var(--src-{esc(k)})"></i>'
                 f'{esc(SRC_CHIP[k])}</span>'
                 f'<span class="hbar-track"><span class="hbar-fill"'
                 f' style="width:{js_round(c / n * 100)}%"></span></span>'
                 f'<span class="hbar-val">{c}</span></div>')
    bars += "</div>"
    no_challenge = n - per_kind.get("challenge", 0)
    chain = ('<div class="qv-card"><h3 class="qv-title">Evidence chain</h3>' + bars
             + f'<p class="qv-foot">Of {n} entries. '
               f'<a href="/review">{no_challenge} link no counterargument</a>: '
               f'a gap, not a consensus.</p></div>')

    # 2. How long each problem had stood. The one place the registry can say something
    # about the problems rather than about the systems that closed them.
    # Longest first, then newest result, then id: same deterministic shape as the feed,
    # and for the same reason (CI diffs these bytes).
    spans = [(years_open(e), e) for e in entries if years_open(e) is not None]
    standing = sorted(spans, key=lambda p: (p[0], p[1].get("date", ""), p[1].get("id", "")),
                      reverse=True)
    posed = len(standing)
    rows = ""
    for yrs, e in standing[:STANDING_ROWS]:
        rows += (f'<li><a href="/finding/{esc(e["id"])}">'
                 f'<b>{yrs} yr</b><span>{esc(e["title"])}</span>'
                 f'<em>posed {e["year_posed"]} · {esc(e.get("model") or "Unknown")}</em>'
                 f'</a></li>')
    longest = ('<div class="qv-card"><h3 class="qv-title">Open longest before falling</h3>'
               f'<ol class="standing">{rows}</ol>'
               f'<p class="qv-foot">From the {posed} of {n} entries recording a posed '
               f'year. <a href="/review">Add a missing one</a>.</p></div>')

    # 3 and 4 are app.js's, ported. The topic cap is a width budget: this card is a
    # quarter of the row here against half a page on /visuals.
    return chain, longest, year_card(entries), topic_card(entries, TOPIC_ROWS)


def build_review(entries):
    """Regenerate /review: the entries that still need work, weakest evidence first.

    This is the registry's open task list, and it is derived rather than curated so it
    cannot go stale or flatter the project. An entry leaves the queue the moment its gap
    is filled in data/entries.json, with no separate list to remember to update.

    Ordering is by how badly the gap matters, not by date. An entry carrying a weak grade
    with nobody having checked it is the worst case: the grade is doing no work and the
    reader has no way to know that.

    The page explains the ask once, in the lede in review.html. Nothing here repeats it.
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

    TIER = {0: ("Weak grade, no check", "The grade rests on the announcing lab alone."),
            1: ("No check yet", "Better evidenced, still unconfirmed outside the lab.")}

    # Each group is a native <details>. The page carried 34 rows plus three gap lists plus a
    # 44-entry challenge list in one scroll; collapsed, the whole backlog is legible at a glance
    # and a visitor opens only the part they intend to work on. <details> is already the
    # disclosure on entry cards: no JavaScript, so nothing for check-integrity.py to flag.
    def q_section(title, sub, body, count, is_open=False):
        return (f'<details class="q-sec"{" open" if is_open else ""}>'
                f'<summary><span class="q-sec-t">{esc(title)}</span>'
                f'<span class="q-sec-n">{count}</span></summary>'
                f'<div class="q-sec-body"><p class="q-sec-sub">{esc(sub)}</p>{body}</div>'
                f'</details>')

    tiers = {}
    for e in queue:
        ver = VER_LABEL.get(e["verification"], e["verification"])
        aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
        check = REPO + "/issues/new?" + "&".join([
            "template=independent-check.yml",
            "title=" + enc_uri_component(f"Independent check: {e['id']}"),
            "entry=" + enc_uri_component(e["id"]),
        ])
        tiers.setdefault(rank(e), []).append(
            f'<div class="q-row">'
            f'<div class="q-main">'
            f'<a class="q-title" href="/finding/{esc(e["id"])}">{esc(e["title"])}</a>'
            f'<div class="q-meta"><span class="pill v v-{esc(e["verification"])}">{esc(ver)}</span>'
            f'<span class="pill a a-{esc(e["autonomy"])}">{esc(aut)}</span>'
            f'<span class="q-lab">{esc(e.get("lab"))}</span></div>'
            f'</div>'
            f'<a class="btn q-act" href="{esc(check)}" target="_blank" rel="noopener">'
            f'Check this<span aria-hidden="true"> ↗</span></a>'
            f'</div>')

    # Only the first tier opens: it is the highest-value work, and a queue that opens showing
    # nothing at all would be compact but useless.
    rows = "".join(
        q_section(TIER[r][0], TIER[r][1], "".join(tiers[r]), len(tiers[r]), is_open=(r == 0))
        for r in sorted(tiers))

    # Smaller gaps, listed compactly. These are good first contributions: each is a
    # single verifiable fact, no judgment about evidence required.
    SMALL = [("year_posed", "Year posed", "The year the problem was first posed."),
             ("discussion", "Discussion", "A thread where the result was debated.")]
    # Collapsed, each of these lists every entry rather than the first eight. The old
    # "and 32 more" existed because the page could not afford the height; an accordion can.
    def link_list(items):
        return ('<p class="q-small-links">'
                + " ".join(f'<a href="/finding/{esc(e["id"])}">{esc(e["title"])}</a>'
                           for e in items) + '</p>')

    small = ""
    for key, label, why in SMALL:
        missing = [e for e in entries if not e.get(key)]
        if not missing:
            continue
        small += q_section(label, why, link_list(missing), len(missing))

    # Entries nobody has cited a counterargument for. Deliberately its own section rather
    # than part of the queue above: this affects most of the registry, and folding it in
    # would drown the verification queue in exactly the way the SMALL gaps were kept out.
    # It is also not a "smaller gap" - finding the strongest objection takes judgment.
    nochallenge = [e for e in entries
                   if not any(s.get("kind") == "challenge" for s in (e.get("sources") or []))]
    if nochallenge:
        small += q_section(
            "No challenge linked",
            "Nobody has cited a rebuttal, a critical review, or prior work. An entry with no "
            "challenge is not necessarily unchallenged; it may just be unexamined.",
            link_list(nochallenge), len(nochallenge))

    summary = (f'<p class="q-sum"><b>{len(queue)}</b> of {len(entries)} entries have no '
               f'independent check.</p>')

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

    # The lede in contributors.html defines what each role is, so the tiers carry only a
    # heading. A blurb per tier restated the lede three times on a page that is mostly
    # names.
    def tier(title, people, verb):
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
        return (f'<section class="c-tier"><h2>{esc(title)}</h2>'
                f'<div class="c-grid">{cards}</div></section>')

    maintainers = "".join(
        f'<div class="c-card"><p class="c-name">{esc(m)}</p>'
        f'<p class="c-count">maintainer</p></div>' for m in citation_authors())
    out = (f'<section class="c-tier"><h2>Maintainers</h2>'
           f'<p class="c-blurb">Authors in '
           f'<a href="{REPO}/blob/main/CITATION.cff">CITATION.cff</a>, so citing the registry '
           f'cites them.</p>'
           f'<div class="c-grid">{maintainers}</div></section>')

    revs, cons = roll("reviewers"), roll("contributors")
    out += tier("Reviewers", revs, "checked")
    out += tier("Contributors", cons, "credited")

    if not revs and not cons:
        out += ('<p class="c-empty">No outside reviewers or contributors yet. Take an entry from '
                'the <a href="/review">review queue</a>, check it, and your name goes here.</p>')

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


def build_chrome(updated):
    """Write the shared header and footer into every static page.

    Was build_nav(), which generated the nav alone while the rest of the chrome stayed
    hand-written in five files. That is how the theme switcher ended up on the home page
    only and the sub-page footer ended up copy-pasted four times. The nav marker is gone:
    page_nav() is now called from inside site_header().
    """
    paths = [p for p, _, _, _ in PAGES] + [p for p, _, _, _ in CHROME_PAGES]
    for path in paths:
        name = "index.html" if path == "/" else path.lstrip("/") + ".html"
        full = os.path.join(ROOT, name)
        src = open(full).read()
        # The home page's eyebrow carries the intro animation hooks; the others do not.
        extra = "intro i1" if path == "/" else ""
        src = inject(src, "<!--HEADER:START-->", "<!--HEADER:END-->",
                     site_header(path, updated, extra), "site header", name)
        src = inject(src, "<!--FOOTER:START-->", "<!--FOOTER:END-->",
                     site_footer(), "site footer", name)
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
    # Rendered with the same pill/dot the cards use, so the page that defines the vocabulary
    # looks like the pages that apply it.
    aut = "\n      ".join(
        f'<div class="meth-row"><span class="pill a a-{a["slug"]}">{esc(a["label"])}</span>\n'
        f'        <p class="meth-def">{esc(a["definition"])}</p></div>'
        for a in AUT)

    srcs = "\n      ".join(
        f'<div class="meth-row kind k-{k["slug"]}">'
        f'<span class="meth-term">{esc(k["label"])}</span>\n'
        f'        <p class="meth-def">{esc(k["definition"])}</p></div>'
        for k in SRC)

    src = inject(src, "<!--VERDEFS:START-->", "<!--VERDEFS:END-->", ver,
                 "verification definitions", "methodology.html")
    src = inject(src, "<!--AUTDEFS:START-->", "<!--AUTDEFS:END-->", aut,
                 "autonomy definitions", "methodology.html")
    src = inject(src, "<!--SRCDEFS:START-->", "<!--SRCDEFS:END-->", srcs,
                 "source kind definitions", "methodology.html")

    with open(path, "w") as f:
        f.write(src)


def build_index(entries, updated):
    path = os.path.join(ROOT, "index.html")
    with open(path) as f:
        src = f.read()

    cards = "\n".join(card(e) for e in entries)
    src = inject(src, "<!--ENTRIES:START-->", "<!--ENTRIES:END-->",
                 "\n" + cards + "\n", "entry list")
    # No newlines around it: verify-parity.py diffs this region against tableView()'s
    # own output, the same way it does the hero matrix.
    src = inject(src, "<!--TABLE:START-->", "<!--TABLE:END-->", table_view(entries),
                 "entry table")

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

    # The other half of the hero. It took the column the four count tiles and the review
    # prompt used to share: a chart says what the registry holds, and this says what has
    # moved in it, which is the pair a returning reader wants. The counts moved down into
    # the reports strip; the review prompt is now this feed's footer.
    src = inject(src, "<!--ACTIVITY:START-->", "<!--ACTIVITY:END-->",
                 build_activity(entries), "activity feed")

    # Four small cards between the hero and the sticky toolbar, one per marker. No
    # newlines around the last two: verify-parity.py diffs those regions against
    # yearCard() and topicCard() in app.js, the same way it does the hero matrix.
    chain, standing, year, topic = build_reports(entries)
    for marker, payload, what in (("RCHAIN", chain, "evidence chain card"),
                                  ("RSTANDING", standing, "longest standing card"),
                                  ("RYEAR", year, "findings per year card"),
                                  ("RTOPIC", topic, "topic area card")):
        src = inject(src, f"<!--{marker}:START-->", f"<!--{marker}:END-->", payload, what)
    src = inject(src, "<!--LABHUB:START-->", "<!--LABHUB:END-->", build_lab_hub(entries),
                 "lab hub")

    src = inject(src, "<!--COUNT:START-->", "<!--COUNT:END-->",
                 f"{len(entries)} / {len(entries)} entries", "result count")
    # The updated stamp used to be injected here, into a marker inside the home page's
    # hand-written eyebrow. site_header() renders it directly now, on all seven page
    # types rather than one.

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
    src = inject(src, "<!--AUTOPTS:START-->", "<!--AUTOPTS:END-->",
                 options((e["autonomy"] for e in entries), AUT_LABEL), "autonomy options")

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
    for field in ("sources", "discussion", "independent_checks", "revisions"):
        for item in (e.get(field) or []):
            if not isinstance(item, dict):
                continue          # shape is reported by validate(), not here
            url = item.get("url")
            # An independent check need not link anywhere: an in-house recomputation
            # or a blind assessment has no URL. card() already renders no link for a
            # missing or empty value, so absent and "" are both legitimate there.
            # A revision is the same: most edits have nothing to point at.
            if field in ("independent_checks", "revisions") and not url:
                continue
            if not isinstance(url, str) or not url.startswith(SAFE_SCHEMES):
                problems.append(
                    f"{where}: {field} URL {url!r} is not an http(s) link. "
                    "javascript:, data: and other schemes are rejected because they "
                    "become executable links on the page.")
    # What each source is: the work itself, the claim made about it, or the case
    # against. The card groups by this, so an unknown value would silently drop a
    # link off the face of the entry rather than render wrongly.
    for i, s in enumerate(e.get("sources") or []):
        kind = s.get("kind")
        if kind is not None and kind not in SRC_LABEL:
            problems.append(f"{where}: sources[{i}] has unknown kind {kind!r} "
                            f"(expected one of: {', '.join(SRC_ORDER)})")
    for v in (e.get("videos") or []):
        # Interpolated into a youtube-nocookie iframe src and a watch?v= link.
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", str(v.get("youtube_id", ""))):
            problems.append(f"{where}: youtube_id {v.get('youtube_id')!r} is not a valid "
                            "11-character YouTube id")


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

    # Source kinds carry a second label: `chip` is the short form for the card-face
    # row, where the column is ~104px, and `label` is the group heading. A kind
    # missing either renders as a blank cell rather than an error, so it is caught here.
    # Revision kinds carry the same two labels for the same reason: `chip` is the pill
    # on a feed row, where the column is narrow, and `label` is the long form.
    for key_name in ("source_kinds", "revision_kinds"):
        kind_seen = set()
        for i, item in enumerate(VOCAB.get(key_name) or []):
            where = f"vocab.json {key_name}[{i}]"
            for key in ("slug", "label", "chip", "short", "definition"):
                if not item.get(key):
                    problems.append(f"{where}: missing '{key}'")
            if item.get("slug") in kind_seen:
                problems.append(f"{where}: duplicate slug '{item.get('slug')}'")
            kind_seen.add(item.get("slug"))
        if not VOCAB.get(key_name):
            problems.append(f"vocab.json: '{key_name}' is missing or empty")
    # build_activity() synthesises this row itself, so its label has to exist.
    if REV_KIND_BUILD_OWNED not in REV_LABEL:
        problems.append(f"vocab.json: revision_kinds has no '{REV_KIND_BUILD_OWNED}' entry, "
                        "which the build needs to label the row it writes per entry")

    # Every value in every vocabulary needs a colour rule, or it renders as an unstyled pill or
    # a colourless dot -- invisible until someone happens to look at that value on the page.
    # Autonomy went years rendering one flat accent for all six because nothing checked it.
    css_path = os.path.join(ROOT, "styles.css")
    if os.path.exists(css_path):
        css = open(css_path).read()
        for axis, items, prefix, what in (
                ("verification", VER, "v", "pill"),
                ("autonomy", AUT, "a", "pill"),
                ("source_kinds", SRC, "k", "dot"),
                ("revision_kinds", REV, "r", "pill")):
            for item in items:
                if f".{prefix}-{item['slug']}" not in css:
                    problems.append(
                        f"vocab.json: {axis} '{item['slug']}' has no .{prefix}-{item['slug']} rule "
                        f"in styles.css, so its {what} would render unstyled")

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
        # What has been edited on this entry since it was added. The activity feed on
        # the home page renders these verbatim, so a malformed one is a broken row in
        # the hero rather than a detail on a page nobody opened.
        revs = e.get("revisions")
        if revs is not None:
            if not isinstance(revs, list):
                problems.append(f"{where}: 'revisions' must be a list of objects")
                revs = []
            for i, r in enumerate(revs):
                if not isinstance(r, dict):
                    problems.append(f"{where}: revisions[{i}] must be an object with "
                                    "'date', 'kind' and 'note'")
                    continue
                rdate = str(r.get("date", ""))
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", rdate):
                    problems.append(f"{where}: revisions[{i}] date '{r.get('date')}' "
                                    "is not YYYY-MM-DD")
                # The feed sorts on this, and an entry cannot be edited before it
                # existed. Catches the commonest slip: copying a revision between
                # entries and leaving the date behind.
                elif e.get("added") and rdate < str(e["added"]):
                    problems.append(f"{where}: revisions[{i}] date {rdate} precedes the "
                                    f"entry's added date {e['added']}")
                kind = r.get("kind")
                if kind == REV_KIND_BUILD_OWNED:
                    problems.append(
                        f"{where}: revisions[{i}] kind '{REV_KIND_BUILD_OWNED}' is owned by "
                        "the build, which writes one per entry from the 'added' field. "
                        f"Use one of: {', '.join(REV_KINDS_AUTHORABLE)}")
                elif kind not in REV_LABEL:
                    problems.append(f"{where}: revisions[{i}] has unknown kind {kind!r} "
                                    f"(expected one of: {', '.join(REV_KINDS_AUTHORABLE)})")
                if not str(r.get("note", "")).strip():
                    problems.append(f"{where}: revisions[{i}] is missing 'note'. An edit "
                                    "with no stated reason is not a record of anything")
        # Editorial rule 4: a claim with no reproducible artifact caps at `claimed`.
        # Stated in docs/SCHEMA.md since the registry began, but unenforceable until
        # sources carried a kind - at which point nine entries turned out to be graded
        # on a press release or a magazine feature alone.
        ver = e.get("verification")
        if (ver in VER_SCORE and VER_SCORE[ver] > 1
                and not any(s.get("kind") == "research" for s in (e.get("sources") or []))):
            kinds = sorted({s.get("kind") for s in (e.get("sources") or []) if s.get("kind")})
            problems.append(
                f"{where}: verification '{ver}' needs a source with kind 'research'; only "
                f"{'/'.join(kinds) or 'unclassified'} links are present. Add the original "
                "work, or downgrade to 'claimed'.")
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

    # The site's notion of "now", and the only one it has: there is no clock in this
    # script (see the note at the top), so "last updated" is the latest date the data
    # itself carries. Revisions count as well as additions, or the badge would claim the
    # registry had not moved since the last new entry while the activity feed in the hero
    # was showing a regrade from a week later.
    stamps = [e["added"] for e in entries if e.get("added")]
    stamps += [r["date"] for e in entries for r in (e.get("revisions") or []) if r.get("date")]
    updated = (max(stamps) if stamps
               else (entries[0].get("date", "") if entries else ""))
    # Vocabulary-derived files first: card() output depends on the labels, so app.js
    # must be current before verify-parity.py diffs it against the pre-rendered cards.
    build_app_js()
    build_methodology()
    queued = build_review(entries)
    build_contributors(entries)
    # After the page builders, so every shell has been written before the shared header
    # and footer go into it. One definition, five pages, no hand-maintained copies.
    build_chrome(updated)
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
            f.write(entry_page(e, entries, updated))

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
