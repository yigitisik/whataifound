#!/usr/bin/env python3
"""Generate feed.json (JSON Feed 1.1) and feed.xml (RSS 2.0) from data/entries.json.

whataifound.org has no build step; this is a standalone generator you run whenever the
registry changes. It writes feed.json and feed.xml at the repo root, next to
data/ and assets/, so Vercel serves them directly.

    python3 scripts/build-feed.py

SITE below is the canonical domain and must match index.html, methodology.html,
visuals.html, sitemap.xml, and robots.txt.
"""
import json, os
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

SITE = "https://whataifound.org"
# Repo root is the parent of scripts/; data/ and the generated feeds live there.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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

with open(os.path.join(ROOT, "data", "entries.json")) as f:
    entries = json.load(f)


def sort_key(e):
    # Newest additions first; fall back to the discovery date when 'added' is absent.
    return (e.get("added") or e.get("date") or "", e.get("date") or "")


entries.sort(key=sort_key, reverse=True)


def dt(datestr):
    """A YYYY-MM-DD string to an aware datetime at midnight UTC."""
    try:
        return datetime.strptime(datestr[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return datetime(1970, 1, 1, tzinfo=timezone.utc)


def summary(e):
    ver = VER_LABEL.get(e["verification"], e["verification"])
    aut = AUT_LABEL.get(e["autonomy"], e["autonomy"])
    parts = [e.get("claim", "")]
    if e.get("detail"):
        parts.append(e["detail"])
    tail = f"Lab: {e.get('lab','')}. Model: {e.get('model','')}. Verification: {ver}. Autonomy: {aut}."
    parts.append(tail)
    return "  ".join(p for p in parts if p)


now = datetime.now(timezone.utc)
feed_url_json = f"{SITE}/feed.json"
feed_url_xml = f"{SITE}/feed.xml"

# ---- JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/) ----
json_feed = {
    "version": "https://jsonfeed.org/version/1.1",
    "title": "whataifound.org: What AI Has Actually Contributed",
    "home_page_url": f"{SITE}/",
    "feed_url": feed_url_json,
    "description": "New and updated entries in the whataifound.org registry of AI contributions to science and mathematics, graded on verification and autonomy.",
    "language": "en",
    "icon": f"{SITE}/assets/brand/og.png",
    "favicon": f"{SITE}/assets/brand/favicon.svg",
    "items": [
        {
            # Point at the entry's own page (built by build-site.py) rather than a
            # homepage fragment: a feed reader, and anything syndicating from it,
            # then links somewhere that stands on its own.
            "id": f"{SITE}/finding/{e['id']}",
            "url": f"{SITE}/finding/{e['id']}",
            "title": e["title"],
            "content_text": summary(e),
            "date_published": dt(e.get("date", "")).isoformat(),
            "date_modified": dt(e.get("added") or e.get("date", "")).isoformat(),
            "tags": e.get("tags", []),
        }
        for e in entries
    ],
}

with open(os.path.join(ROOT, "feed.json"), "w") as f:
    json.dump(json_feed, f, indent=2, ensure_ascii=False)
    f.write("\n")

# ---- RSS 2.0 ----
items_xml = []
for e in entries:
    link = f"{SITE}/finding/{e['id']}"
    pub = format_datetime(dt(e.get("added") or e.get("date", "")))
    cats = "".join(f"<category>{escape(t)}</category>" for t in e.get("tags", []))
    items_xml.append(
        "<item>"
        f"<title>{escape(e['title'])}</title>"
        f"<link>{escape(link)}</link>"
        f"<guid isPermaLink=\"false\">{escape(link)}</guid>"
        f"<pubDate>{pub}</pubDate>"
        f"<description>{escape(summary(e))}</description>"
        f"{cats}"
        "</item>"
    )

rss = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
    "<channel>\n"
    "<title>whataifound.org: What AI Has Actually Contributed</title>\n"
    f"<link>{SITE}/</link>\n"
    f'<atom:link href="{feed_url_xml}" rel="self" type="application/rss+xml" />\n'
    "<description>New and updated entries in the whataifound.org registry of AI "
    "contributions to science and mathematics, graded on verification and autonomy.</description>\n"
    "<language>en</language>\n"
    f"<lastBuildDate>{format_datetime(now)}</lastBuildDate>\n"
    f"<image><url>{SITE}/assets/brand/og.png</url><title>whataifound.org</title>"
    f"<link>{SITE}/</link></image>\n"
    + "\n".join(items_xml)
    + "\n</channel>\n</rss>\n"
)

with open(os.path.join(ROOT, "feed.xml"), "w") as f:
    f.write(rss)

print(f"Wrote feed.json and feed.xml ({len(entries)} items).")
