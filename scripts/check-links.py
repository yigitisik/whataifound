#!/usr/bin/env python3
"""Check that the external URLs in data/entries.json still resolve.

    python3 scripts/check-links.py              # every URL in the registry
    python3 scripts/check-links.py --changed    # only URLs not in git HEAD (for CI)
    python3 scripts/check-links.py --json out.json

Why this exists
---------------
The registry's whole claim is that its sources say what it says they say. Every other
check here is structural: the build validates shapes and grades, check-integrity.py
validates markup. None of them can notice that a primary source 404s, and CONTRIBUTING
asks a human reviewer to open every link, which is exactly the step a tired volunteer
skips. Link rot is silent and it is the failure mode that costs the registry its
credibility, so it is worth a machine.

What counts as a failure
------------------------
Only 404 and 410: the page is affirmatively gone. Everything else is reported but does
not fail the run, because the alternative trains people to ignore this check:

  403 / 401     Cloudflare and publisher paywalls block CI user-agents by default.
                Nature, ScienceDirect and arXiv all do this intermittently.
  429           Rate limiting. Says nothing about the URL.
  5xx           The origin is having a bad day.
  timeouts      Ditto, or CI has no route to that host.

A redirect is followed and reported when it lands somewhere else, since a source that
now redirects to a paywall or a generic landing page is worth a human look even though
it technically resolves.
"""
import argparse
import concurrent.futures
import json
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "entries.json")

# A real browser UA. Several publishers 403 anything that looks like a script, which
# would otherwise make the check useless noise on exactly the domains that matter most.
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
TIMEOUT = 25
DEAD = (404, 410)


def urls_from(entries):
    """Every external URL in the registry, tagged with the entry and field it came from."""
    out = []
    for e in entries:
        for s in e.get("sources") or []:
            out.append((e["id"], "source", s.get("label", ""), s["url"]))
        for s in e.get("discussion") or []:
            out.append((e["id"], "discussion", s.get("label", ""), s["url"]))
        for c in e.get("independent_checks") or []:
            if c.get("url"):
                out.append((e["id"], "independent_check", c.get("who", ""), c["url"]))
        # A registration is the strongest evidence an entry can carry, so a record that
        # has moved or been withdrawn is the worst dead link on the site: the page would
        # keep asserting a machine check that no longer resolves.
        for r in e.get("registrations") or []:
            out.append((e["id"], "registration", r.get("id", ""), r["url"]))
        # Videos carry an id rather than a URL, so they were invisible to this check and a
        # pulled or privated video would sit on the page indefinitely. youtube.com/watch
        # answers 404 for an unknown id, which is exactly what DEAD looks for.
        for v in e.get("videos") or []:
            if v.get("youtube_id"):
                out.append((e["id"], "video", v.get("label", ""),
                            f"https://www.youtube.com/watch?v={v['youtube_id']}"))
    return out


def changed_only(rows):
    """Drop URLs that already exist in git HEAD, leaving what this branch added.

    Keeps CI proportional to the diff: an entry PR adds a handful of links, and
    re-checking all ~90 every run is slow and invites rate limiting.
    """
    try:
        head = subprocess.run(["git", "show", "HEAD:data/entries.json"],
                              cwd=ROOT, capture_output=True, text=True, check=True).stdout
        known = {u for _, _, _, u in urls_from(json.loads(head))}
    except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError):
        return rows          # no baseline (first commit, shallow clone): check all
    return [r for r in rows if r[3] not in known]


def check(row):
    """Resolve one URL. HEAD first, then GET: some hosts refuse HEAD outright."""
    eid, kind, label, url = row
    ctx = ssl.create_default_context()
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA}, method=method)
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
                final = resp.geturl()
                return {"id": eid, "kind": kind, "label": label, "url": url,
                        "status": resp.status,
                        "redirect": final if final.rstrip("/") != url.rstrip("/") else None}
        except urllib.error.HTTPError as exc:
            # Retry a blocked HEAD as GET before believing it.
            if method == "HEAD" and exc.code in (403, 405, 501):
                continue
            return {"id": eid, "kind": kind, "label": label, "url": url,
                    "status": exc.code, "redirect": None}
        except Exception as exc:                       # timeout, DNS, TLS, no route
            if method == "HEAD":
                continue
            return {"id": eid, "kind": kind, "label": label, "url": url,
                    "status": type(exc).__name__, "redirect": None}
    return {"id": eid, "kind": kind, "label": label, "url": url,
            "status": "unreachable", "redirect": None}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--changed", action="store_true",
                    help="only URLs added relative to git HEAD")
    ap.add_argument("--json", metavar="PATH", help="write the full result set here")
    ap.add_argument("--jobs", type=int, default=8, help="parallel requests (default 8)")
    args = ap.parse_args()

    rows = urls_from(json.load(open(DATA)))
    scope = "all"
    if args.changed:
        rows, scope = changed_only(rows), "new/changed"

    if not rows:
        print("No new external URLs to check.")
        return 0

    print(f"Checking {len(rows)} {scope} URL(s)...\n")
    with concurrent.futures.ThreadPoolExecutor(args.jobs) as ex:
        results = list(ex.map(check, rows))

    dead = [r for r in results if r["status"] in DEAD]
    warn = [r for r in results if r["status"] not in DEAD and r["status"] != 200]
    moved = [r for r in results if r["status"] == 200 and r["redirect"]]

    if args.json:
        with open(args.json, "w") as f:
            json.dump(results, f, indent=2)

    for r in dead:
        print(f"  DEAD  {r['status']}  {r['id']} [{r['kind']}]\n        {r['url']}")
    for r in warn:
        print(f"  warn  {r['status']}  {r['id']} [{r['kind']}]\n        {r['url']}")
    for r in moved:
        print(f"  moved 200  {r['id']} [{r['kind']}]\n        {r['url']}\n     -> {r['redirect']}")

    ok = len(results) - len(dead) - len(warn)
    print(f"\n{ok}/{len(results)} resolved. "
          f"{len(dead)} dead, {len(warn)} unverified, {len(moved)} redirected.")

    if dead:
        print("\nA dead link means the entry's evidence is gone. Replace the URL with a "
              "working one (an archive.org snapshot is acceptable for a source that "
              "existed), or downgrade the entry.")
        return 1
    if warn:
        print("\nUnverified links are not failures: publishers block automated requests. "
              "Open them by hand if the entry is new.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
