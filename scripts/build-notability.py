#!/usr/bin/env python3
"""Compute the `notability` of each entry from the live Wikipedia API.

Notability here is one checkable fact: how many Wikipedia language editions carry an
article for the problem. An entry names its article in the optional `wikipedia` field
(a title like "Jacobian conjecture" or a full en.wikipedia.org URL); this script asks
the API for that page's language links, follows redirects to the canonical article, and
writes back:

    "notability": <editions>,                 # language editions incl. English
    "notability_meta": {                       # audit trail, never hand-edited
        "source": "wikipedia-langlinks",
        "article": "<resolved title>",
        "editions": <editions>,
        "as_of": "<YYYY-MM-DD>"
    }

Entries with no `wikipedia` field are left unrated (both keys removed if present). Because
the count is measured, not guessed, anyone can re-run this and get the same answer, which
reproducibility is the point. Run it whenever entries or their articles change:

    python3 scripts/build-notability.py                 # update data/entries.json in place
    python3 scripts/build-notability.py --check         # report drift, write nothing (CI-friendly)
    python3 scripts/build-notability.py --as-of 2026-07-24   # stamp a fixed measurement date

Network access is required. macOS python.org builds often lack a CA bundle for urllib, so
this falls back to `certifi` and then to the system `curl` before giving up.
"""
import json, os, sys, ssl, subprocess, urllib.parse, urllib.request
from datetime import datetime, timezone

# Repo root is the parent of scripts/; data/entries.json lives there.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRIES = os.path.join(ROOT, "data", "entries.json")
API = "https://en.wikipedia.org/w/api.php"
UA = "whataifound-notability/1.0 (https://whataifound.org)"

# Where notability/notability_meta sit when we (re)insert them: right after year_posed
# if present, else after wikipedia, else after model. Keeps the file diff-friendly.
ORDER = ["id", "title", "claim", "field", "date", "lab", "model", "humans",
         "year_posed", "wikipedia", "notability", "notability_meta",
         "verification", "autonomy", "detail", "novelty_check", "caveats",
         "independent_checks", "sources", "discussion", "videos", "tags",
         "contributors", "reviewers", "added"]


def reorder(e):
    out = {k: e[k] for k in ORDER if k in e}
    for k in e:                       # preserve any unexpected keys
        if k not in out:
            out[k] = e[k]
    return out


def article_title(field):
    """Accept a bare title or a Wikipedia URL; return the page title to query."""
    field = field.strip()
    if "wikipedia.org/wiki/" in field:
        slug = field.split("/wiki/", 1)[1].split("#")[0].split("?")[0]
        return urllib.parse.unquote(slug).replace("_", " ")
    return field


def _fetch(url):
    """GET a URL, returning the body as text. Tries urllib (default context, then
    certifi), then curl, so a missing CA bundle doesn't stop the build."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8")
    except ssl.SSLError:
        try:
            import certifi
            ctx = ssl.create_default_context(cafile=certifi.where())
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                return r.read().decode("utf-8")
        except Exception:
            pass
    except Exception:
        pass
    # Last resort: curl (present on macOS/Linux, has its own trust store).
    try:
        out = subprocess.run(
            ["curl", "-sS", "-A", UA, url],
            capture_output=True, text=True, timeout=25, check=True)
        return out.stdout
    except Exception as e:
        raise RuntimeError(f"could not fetch {url}: {e}")


def count_editions(title):
    """Return (editions, resolved_title) for a page, following redirects.
    editions counts language editions including English. Returns (None, resolved)
    when the article does not exist."""
    q = urllib.parse.urlencode({
        "action": "query", "prop": "langlinks", "titles": title,
        "redirects": "1", "lllimit": "500", "format": "json",
    })
    data = json.loads(_fetch(f"{API}?{q}"))
    query = data.get("query", {})
    page = next(iter(query.get("pages", {}).values()), {})
    resolved = page.get("title", title)
    if "missing" in page or not page:
        return None, resolved
    # +1 for the English article itself; langlinks are the *other* editions.
    return len(page.get("langlinks", [])) + 1, resolved


def main():
    args = sys.argv[1:]
    check_only = "--check" in args
    as_of = None
    if "--as-of" in args:
        as_of = args[args.index("--as-of") + 1]
    else:
        as_of = datetime.now(timezone.utc).date().isoformat()

    entries = json.load(open(ENTRIES, encoding="utf-8"))
    drift, rated, cleared, missing = [], 0, 0, []

    for e in entries:
        wiki = e.get("wikipedia")
        if not wiki:
            # No article claimed: entry must stay unrated. Remove stale keys if any.
            if e.pop("notability", None) is not None or e.pop("notability_meta", None) is not None:
                cleared += 1
            continue
        title = article_title(wiki)
        editions, resolved = count_editions(title)
        if editions is None:
            missing.append((e["id"], resolved))
            # Article claimed but not found: leave unrated, flag loudly.
            if e.pop("notability", None) is not None or e.pop("notability_meta", None) is not None:
                cleared += 1
            continue
        old = e.get("notability")
        if old != editions:
            drift.append((e["id"], old, editions, resolved))
        e["notability"] = editions
        e["notability_meta"] = {
            "source": "wikipedia-langlinks",
            "article": resolved,
            "editions": editions,
            "as_of": as_of,
        }
        rated += 1

    entries = [reorder(e) for e in entries]

    print(f"Rated {rated} entries; cleared {cleared}; {len(missing)} claimed-but-missing.")
    for eid, old, new, art in drift:
        print(f"  drift  {eid}: {old} -> {new}  ({art!r})")
    for eid, art in missing:
        print(f"  MISSING article for {eid}: {art!r}. Remove `wikipedia` or fix the title")

    if check_only:
        if drift or missing:
            print("Drift detected (--check): entries.json NOT written.")
            sys.exit(1)
        print("No drift.")
        return

    json.dump(entries, open(ENTRIES, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(ENTRIES, "a", encoding="utf-8").write("\n")
    print(f"Wrote {ENTRIES}")


if __name__ == "__main__":
    main()
