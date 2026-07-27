#!/usr/bin/env python3
"""Pre-render the registry into static HTML, and generate per-entry pages, llms.txt and the sitemap.

Why this exists
---------------
index.html used to ship an empty <main id="list"> that app.js filled in after fetching
data/entries.json. Google renders JS eventually, but the AI crawlers robots.txt explicitly
invites (GPTBot, ClaudeBot, PerplexityBot, CCBot) largely do not — so every one of them
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
import os
import re
from datetime import date, datetime, timezone
from urllib.parse import quote, urlparse

SITE = "https://whataifound.org"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- label tables
# Mirrors of the constants at the top of app.js.
VER_LABEL = {
    "formal": "Formally verified", "independent": "Independently checked",
    "peer-reviewed": "Peer reviewed", "author-verified": "Author verified",
    "claimed": "Claimed", "disputed": "Disputed", "known": "Already known",
    "refuted": "Refuted",
}
AUT_LABEL = {
    "autonomous": "Autonomous", "ai-led": "AI-led", "collaborative": "Collaborative",
    "ai-assisted": "AI-assisted", "search-scaffold": "Search scaffold", "retrieval": "Retrieval",
}

# How each verification grade maps onto a schema.org Rating, so a machine reading
# ClaimReview gets the same ordering a reader gets from the pill colours. 5 = the
# claim stands up; 1 = it does not. "known" is a true result that is not new, so it
# sits mid-scale rather than at the bottom.
VER_RATING = {
    "formal": (5, "Formally verified: machine-checked proof"),
    "independent": (5, "Independently checked by third parties"),
    "peer-reviewed": (4, "Peer reviewed"),
    "author-verified": (3, "Author verified only"),
    "claimed": (2, "Claimed, not independently verified"),
    "known": (2, "Already known: correct but not novel"),
    "disputed": (1, "Disputed"),
    "refuted": (1, "Refuted"),
}

FIELD_LABEL = {
    "mathematics": "Mathematics", "computer-science": "Computer science",
    "biology": "Biology", "materials": "Materials science", "physics": "Physics",
}

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


def esc(s):
    """The exact escape app.js's esc() performs: & < > " and nothing else.

    Notably NOT html.escape(), which also encodes ' as &#x27; — that would make the
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
            f'            <a class="vid-ext" href="https://www.youtube.com/watch?v={quote(str(v["youtube_id"]), safe="")}" '
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
      <h2>{esc(e["title"])}<a class="permalink" href="#e-{esc(e["id"])}" data-permalink="e-{esc(e["id"])}" aria-label="Copy link to this entry" title="Copy link to this entry">#</a></h2>
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


# ------------------------------------------------------------------ structured data
def claim_review(e, url):
    """ClaimReview: the schema.org type for rating a claim's truthfulness.

    This is the closest match in the vocabulary to what the registry actually does —
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
        "creditText": f"whataifound.org — verification: {ver}; autonomy: {aut}.",
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
    answers twenty-two. The lede paragraph is written to be quotable on its own —
    it states the verdict before the detail, because the first sentence is what
    gets lifted into an answer.
    """
    url = f"{SITE}/finding/{e['id']}"
    ver = VER_LABEL.get(e["verification"], e["verification"])
    aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
    n = years_open(e)

    verdict = (f"{e['title']} is graded {ver.lower()} on whataifound.org, with the AI's "
               f"role graded {aut.lower()}.")
    meta_desc = f"{verdict} {e['claim']}"[:300]

    ld = json.dumps(entry_jsonld(e, url), indent=2, ensure_ascii=False)

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

<title>{esc(e["title"])} — graded {esc(ver)} | whataifound.org</title>
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
<link rel="mask-icon" href="/assets/brand/favicon.svg" color="#0b0d10">
<link rel="alternate" type="application/feed+json" href="/feed.json" title="whataifound.org (JSON Feed)">
<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="whataifound.org (RSS)">

<script type="application/ld+json">
{ld}
</script>

<script>try{{var tm=localStorage.getItem('theme'),el=document.documentElement;if(tm==='light'||tm==='dark')el.setAttribute('data-theme',tm);else if(tm!=='system')el.setAttribute('data-theme','dark');}}catch(e){{}}</script>

<link rel="stylesheet" href="/styles.css">
</head>
<body class="finding-page">
<div class="spectrum" aria-hidden="true"></div>
<div class="wrap">

<nav class="crumb" aria-label="Breadcrumb">
  <a href="/">whataifound.org</a> <span aria-hidden="true">/</span> <span>Finding</span>
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
{section("What was found", e.get("detail"))}{section("Novelty check", e.get("novelty_check"))}{section("Caveats", e.get("caveats"))}{checks}{sources}{discussion}

  <h2 class="lbl">How this is graded</h2>
  <p>whataifound.org grades every entry on two axes: <strong>verification</strong> (how solid the
  result is, from a machine-checked proof down to refuted) and <strong>autonomy</strong> (how much
  the AI did versus its human collaborators). This finding is <strong>{esc(ver.lower())}</strong>
  and <strong>{esc(aut.lower())}</strong>. Full definitions are in the
  <a href="/methodology">methodology</a>.</p>

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
    what the registry is, what the grades mean, and links every entry — so a model
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
        "> press release. Negative results — already known, disputed, refuted — stay on the",
        "> record rather than being deleted.",
        "",
        f"Maintained as an independent editorial project. {len(entries)} entries on record. "
        "Data is CC BY 4.0; cite as whataifound.org.",
        "",
        "## How entries are graded",
        "",
        "Verification, strongest to weakest — when unsure, the lower grade wins:",
        "",
    ]
    order = ["formal", "independent", "peer-reviewed", "author-verified",
             "claimed", "disputed", "known", "refuted"]
    desc = {
        "formal": "machine-checked proof (e.g. Lean)",
        "independent": "checked by third parties who were not the authors",
        "peer-reviewed": "published after peer review",
        "author-verified": "verified only by the people who produced it",
        "claimed": "announced, not independently verified",
        "disputed": "substantive public challenge to the result",
        "known": "correct, but the result already existed in the literature",
        "refuted": "shown to be wrong",
    }
    lines += [f"- **{VER_LABEL[k]}** — {desc[k]}" for k in order]
    lines += ["", "Autonomy, most to least AI-driven:", ""]
    aut_desc = {
        "autonomous": "the AI did it without human problem-setting or steering",
        "ai-led": "the AI produced the core idea; humans framed or checked it",
        "collaborative": "genuine back-and-forth between AI and human",
        "ai-assisted": "humans led; the AI helped with parts",
        "search-scaffold": "a human-built search harness (FunSearch, AlphaEvolve) with an LLM inside",
        "retrieval": "the AI located an existing result rather than producing a new one",
    }
    lines += [f"- **{AUT_LABEL[k]}** — {aut_desc[k]}"
              for k in ["autonomous", "ai-led", "collaborative", "ai-assisted",
                        "search-scaffold", "retrieval"]]
    lines += [
        "",
        "## Core pages",
        "",
        f"- [Registry]({SITE}/): all entries, searchable and filterable",
        f"- [Methodology]({SITE}/methodology): full definitions of both grading scales and the editorial rules",
        f"- [Visuals]({SITE}/visuals): the registry as charts",
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
def build_sitemap(entries, today):
    urls = [(f"{SITE}/", today, "weekly", "1.0"),
            (f"{SITE}/methodology", today, "monthly", "0.7"),
            (f"{SITE}/visuals", today, "weekly", "0.7")]
    for e in sorted(entries, key=lambda x: x.get("date", ""), reverse=True):
        lastmod = (e.get("added") or e.get("date") or today)[:10]
        urls.append((f"{SITE}/finding/{e['id']}", lastmod, "monthly", "0.8"))
    body = "\n".join(
        f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{m}</lastmod>\n"
        f"    <changefreq>{c}</changefreq>\n    <priority>{p}</priority>\n  </url>"
        for u, m, c, p in urls)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{body}\n</urlset>\n")


# ------------------------------------------------------------------ index.html
def inject(src, start, end, payload, what):
    """Replace everything between two marker comments. Fails loudly if absent."""
    i, j = src.find(start), src.find(end)
    if i == -1 or j == -1:
        raise SystemExit(f"index.html: missing {what} markers ({start} / {end}). "
                         "Restore them or re-run against a clean checkout.")
    return src[:i + len(start)] + payload + src[j:]


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

    src = inject(src, "<!--COUNT:START-->", "<!--COUNT:END-->",
                 f"{len(entries)} / {len(entries)} entries", "result count")
    src = inject(src, "<!--UPDATED:START-->", "<!--UPDATED:END-->", updated, "updated date")

    # The "how many are actually verified" FAQ answer quotes these tallies. It lives
    # inside the JSON-LD, where an HTML comment marker would become literal text an
    # answer engine quotes back — so the sentence is rewritten in place by pattern
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
def main():
    with open(os.path.join(ROOT, "data", "entries.json")) as f:
        entries = json.load(f)

    # Same order the site shows: newest discovery first. app.js sorts identically,
    # so the pre-rendered DOM and the hydrated DOM agree.
    entries.sort(key=lambda e: e.get("date", ""), reverse=True)

    updated = (sorted(e["added"] for e in entries if e.get("added"))[-1]
               if any(e.get("added") for e in entries)
               else (entries[0].get("date", "") if entries else ""))
    today = date.today().isoformat()

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
        f.write(build_sitemap(entries, today))

    print(f"Pre-rendered {len(entries)} entries into index.html")
    print(f"Wrote finding/ ({len(entries)} pages), llms.txt, sitemap.xml "
          f"({len(entries) + 3} URLs).")


if __name__ == "__main__":
    main()
