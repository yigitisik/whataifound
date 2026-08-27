#!/usr/bin/env python3
"""What changed since last time, as facts rather than as judgement. Never writes an entry.

This is the deterministic half of the twice-weekly watch. It answers only the questions
that have exact answers, so that nothing downstream has to trust a model about arithmetic:
which registry records are new, which of our entries could carry a registration it does
not, which cited records have moved under us, and which cited arXiv preprints have since
been published or withdrawn. The judgement half runs afterwards and starts from this file.

The registry is its own state. There is no watch-state.json to commit, drift, or forget,
for the same reason /review is derived rather than curated: a list maintained beside the
data eventually flatters the data. Everything here is live registry data diffed against
data/entries.json, so a run is reproducible from the repo alone.

Outside build.py, like check-links.py and check-registries.py, because it hits the network.

    python3 scripts/watch-registry.py                      # human-readable summary
    python3 scripts/watch-registry.py --json facts.json    # the machine-readable artifact
    python3 scripts/watch-registry.py --days 30            # widen the new-candidate window
    python3 scripts/watch-registry.py --entries FILE       # diff a different registry state

Exit status is 0 whether or not it finds anything. Silence is a legitimate answer; a
missing cross-link is a gap to fill, not a broken build.

Known limit, stated so the output is not read as coverage: this sees only what the four
registries and arXiv publish. A result announced on a lab blog and not yet catalogued
anywhere is invisible here, which is precisely what the second stage is for.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "entries.json")
ARXIV_API = "http://export.arxiv.org/api/query"

# The new-candidate window deliberately overlaps the cadence it is run at. On a Monday and
# Thursday schedule the gap between runs is three or four days, so a fortnight of lookback
# means four consecutive runs would have to be missed before anything could fall through a
# crack. Re-reporting something already seen is cheap; missing it once is silent forever.
DEFAULT_DAYS = 14

# vibemathed's own ladder, coarsened to something comparable with ours. Only the distance
# between the two matters here, never the absolute value: this exists to notice that we and
# they disagree by a lot, not to claim their rung is the correct one.
VM_TIER = {"unreviewed": 0, "contested": 0, "site-confirmed": 1,
           "lean-checked": 2, "lean-verified": 3, "expert-verified": 3}
OUR_TIER = {"refuted": 0, "disputed": 0, "known": 0, "claimed": 0,
            "author-verified": 1, "peer-reviewed": 2, "independent": 2, "formal": 3}


def load_check_registries():
    """Import the sibling script for its fetchers and its tuned matcher.

    Imported by path because the filename has a hyphen. Its main() is guarded, so this
    costs nothing but the import. Reusing it rather than restating it is the point: the
    score floors in there were tuned against hand-verified pairs, and a second copy would
    drift away from them the first time either was touched.
    """
    path = os.path.join(ROOT, "scripts", "check-registries.py")
    spec = importlib.util.spec_from_file_location("check_registries", path)
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, [path]
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.argv = argv
    return mod


def cited(entries, registry):
    """Every id of `registry` any entry already points at."""
    return {r["id"] for e in entries for r in (e.get("registrations") or [])
            if r["registry"] == registry}


def arxiv_ids(entry):
    """The arXiv ids that could plausibly be *this* result, not its prior art.

    Entries cite the literature they supersede, and those citations are `research` sources
    too, so filtering by kind does not separate them. The date does: an id encodes YYMM, and
    a paper from years before the finding is the thing being improved on, not the finding.
    Without this the gaussian-moments entry reports its own 2015 reference as newly
    published, every single run, forever.
    """
    ym = entry["date"][2:4] + entry["date"][5:7]
    out = []
    for s in entry.get("sources", []):
        m = re.search(r"arxiv\.org/(?:abs|pdf|html)/([0-9]{4}\.[0-9]{4,5})", s["url"])
        if not m:
            continue
        # Six months of slack: a preprint can predate the date we record for the result.
        if int(m.group(1)[:4]) < int(ym) - 6:
            continue
        out.append(m.group(1))
    return out


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# --------------------------------------------------------------------------- checks

def new_candidates(cr, entries, vm, pal, cutoff, min_sig):
    """Registry records nobody here cites, recent enough to still be news."""
    out = []
    seen_vm, seen_pal = cited(entries, "vibemathed"), cited(entries, "palomar")
    # Palomar has no significance score and no editorial filter, so one submitter working
    # through a backlog can dominate a window. Counting a repository's registrations in the
    # window is the cheapest available signal that a row is part of a bulk upload rather
    # than a result someone is announcing.
    repo_runs = {}
    for it in pal:
        if ((it.get("published_at") or "")[:10]) >= cutoff:
            repo = (it.get("source") or {}).get("repository") or it["id"]
            repo_runs[repo] = repo_runs.get(repo, 0) + 1
    for p in vm:
        d = p.get("solveDate") or ""
        if d < cutoff or p["slug"] in seen_vm:
            continue
        if (p.get("significance") or 0) < min_sig:
            continue
        out.append({
            "kind": "new_candidate", "registry": "vibemathed", "id": p["slug"],
            "date": d, "title": p.get("name") or p["slug"],
            "url": f"https://vibemathed.com/problem/{p['slug']}",
            "source_url": p.get("sourceUrl"),
            "significance": p.get("significance"),
            "registry_verification": p.get("verification"),
            "registry_resolution": p.get("resolution"),
            "ai_contribution": p.get("aiContribution"),
            "model": p.get("model"),
            "humans": p.get("humanCollaborators"),
            "year_posed": p.get("yearPosed"),
        })
    for it in pal:
        d = (it.get("published_at") or "")[:10]
        if d < cutoff or it["id"] in seen_pal:
            continue
        src = it.get("source") or {}
        out.append({
            "kind": "new_candidate", "registry": "palomar", "id": it["id"],
            "date": d, "title": src.get("repository") or it.get("title"),
            "url": f"https://palomar-registry.org/entry?id={it['id']}"
                   f"&version={it.get('version', 1)}",
            "repository": src.get("repository"), "commit": src.get("commit"),
            "theorems": (it.get("formalization") or {}).get("theorem_names"),
            "abstract": (it.get("abstract") or "")[:700],
            "authors": [a.get("name") for a in (it.get("authors") or [])],
            "repo_registrations_in_window": repo_runs.get(
                src.get("repository") or it["id"], 1),
        })
    out.sort(key=lambda r: (r["date"], str(r.get("significance") or "")), reverse=True)
    return out


def registrations_available(cr, entries, pools, weights, min_words):
    """A record that matches one of our entries above the tuned floor and is not cited.

    Ranked, not filtered, and that is a deliberate retreat from a filter I tried first.

    Single-word matches are mostly noise: MathDB carries slugs like "combinatorics" and
    "geometry problem 1" that score 1.00 against anything in their field. But dropping them
    also drops "jacobian conjecture", which is a real match and also one word. IDF does not
    separate the two, and measuring it says so plainly: over the 74k MathDB slugs
    "combinatorics" scores 8.96 and "jacobian" 7.66, so the noise word is the rarer one.
    No threshold on rarity, word count or score puts those two on opposite sides.

    So the word count becomes a ranking signal and a confidence label instead of a cutoff,
    and the caller decides. Same conclusion the sibling script reached: these are leads to
    open, not matches to apply.
    """
    out = []
    for e in sorted(entries, key=lambda x: x["id"]):
        if e.get("field") != "mathematics" and e.get("field") != "computer-science":
            continue
        have = {r["registry"] for r in (e.get("registrations") or [])}
        needle = cr.toks(e["title"])
        for name, pool in pools.items():
            if name in have or not pool:
                continue
            floor = cr.FLOOR.get(name, cr.MIN_SCORE)
            hits = cr.candidates(needle, pool, weights[name], floor)[:1]
            for score, nhits, label, url in hits:
                if nhits < min_words:
                    continue
                strong, wide = score >= 0.9, nhits >= 2
                out.append({
                    "kind": "registration_available", "entry": e["id"],
                    "entry_title": e["title"], "registry": name,
                    "candidate": label, "url": url,
                    "score": round(score, 3), "words_matched": nhits,
                    "confidence": "high" if (strong and wide)
                    else "medium" if (strong or wide) else "low",
                })
    out.sort(key=lambda r: (-r["words_matched"], -r["score"]))
    return out


def label_drift(entries, vm_by_slug):
    """Cited vibemathed records that have moved, or that we disagree with sharply."""
    out = []
    for e in entries:
        for r in (e.get("registrations") or []):
            if r["registry"] != "vibemathed":
                continue
            p = vm_by_slug.get(r["id"])
            if p is None:
                out.append({"kind": "label_drift", "entry": e["id"], "signal": "record_gone",
                            "observed": f"vibemathed no longer lists {r['id']}",
                            "suggested": "correction", "confidence": "high",
                            "evidence": [r["url"]]})
                continue
            base = {"kind": "label_drift", "entry": e["id"], "entry_title": e["title"],
                    "our_verification": e["verification"], "evidence": [r["url"]],
                    "registry_verification": p.get("verification"),
                    "registry_resolution": p.get("resolution")}
            # Ordered worst first: a retraction is not a tier disagreement to weigh up.
            if p.get("resolution") == "retracted":
                out.append(dict(base, signal="retracted", confidence="high",
                                suggested="regrade",
                                observed="vibemathed now records this result as retracted"))
            elif p.get("verification") == "contested":
                out.append(dict(base, signal="contested", confidence="high",
                                suggested="challenge",
                                observed="vibemathed now records this result as contested"))
            elif p.get("claimIssueNote"):
                out.append(dict(base, signal="claim_issue", confidence="high",
                                suggested="challenge",
                                observed="vibemathed has attached an issue note: "
                                         + str(p["claimIssueNote"])[:300]))
            else:
                ours = OUR_TIER.get(e["verification"], 0)
                theirs = VM_TIER.get(p.get("verification"), 0)
                if theirs - ours >= 2:
                    out.append(dict(base, signal="they_grade_higher", confidence="medium",
                                    suggested="check",
                                    observed="vibemathed records %s where this entry is %s"
                                             % (p.get("verification"), e["verification"])))
                elif ours - theirs >= 2:
                    out.append(dict(base, signal="we_grade_higher", confidence="low",
                                    suggested="check",
                                    observed="this entry is %s where vibemathed records %s"
                                             % (e["verification"], p.get("verification"))))
    return out


def arxiv_status(cr, entries):
    """Cited preprints that have since been published, or withdrawn."""
    wanted, by_id = [], {}
    for e in entries:
        for aid in arxiv_ids(e):
            wanted.append(aid)
            by_id.setdefault(aid, []).append(e)
    out = []
    for batch in chunks(sorted(set(wanted)), 40):
        q = "%s?id_list=%s&max_results=%d" % (ARXIV_API, ",".join(batch), len(batch))
        body = cr.fetch(q, "arXiv metadata")
        if not body:
            continue
        ns = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
        for node in ET.fromstring(body).findall("a:entry", ns):
            raw = (node.findtext("a:id", "", ns) or "").rsplit("/abs/", 1)[-1]
            aid = raw.split("v")[0]
            jref = node.findtext("arxiv:journal_ref", None, ns)
            comment = node.findtext("arxiv:comment", "", ns) or ""
            withdrawn = "withdraw" in comment.lower()
            for e in by_id.get(aid, []):
                if withdrawn:
                    out.append({"kind": "arxiv_status", "entry": e["id"], "arxiv": aid,
                                "signal": "withdrawn", "confidence": "high",
                                "suggested": "regrade", "observed": comment.strip()[:300],
                                "evidence": [f"https://arxiv.org/abs/{aid}"]})
                elif jref and OUR_TIER.get(e["verification"], 0) < 2:
                    out.append({"kind": "arxiv_status", "entry": e["id"], "arxiv": aid,
                                "signal": "now_published", "confidence": "medium",
                                "suggested": "regrade",
                                "observed": "journal reference appeared: " + jref.strip()[:200],
                                "our_verification": e["verification"],
                                "evidence": [f"https://arxiv.org/abs/{aid}"]})
    return out


# --------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", metavar="PATH", help="write the full fact set here")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS,
                    help="new-candidate lookback window (default %d)" % DEFAULT_DAYS)
    ap.add_argument("--entries", metavar="PATH", default=DATA,
                    help="registry state to diff against (default data/entries.json)")
    ap.add_argument("--min-significance", type=int, default=10, metavar="N",
                    help="drop vibemathed candidates below this score (default 10)")
    ap.add_argument("--min-words", type=int, default=1, metavar="N",
                    help="drop registration matches sharing fewer words (default 1, no cut)")
    ap.add_argument("--quiet", action="store_true", help="suppress the summary")
    a = ap.parse_args()

    cr = load_check_registries()
    entries = json.load(open(a.entries, encoding="utf-8"))
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=a.days)).strftime("%Y-%m-%d")

    if not a.quiet:
        print("Reading vibemathed, MathDB, Palomar and ProofAtlas...", file=sys.stderr)

    vm_raw = cr.fetch(cr.VIBEMATHED, "vibemathed dataset")
    vm = json.loads(vm_raw).get("problems", []) if vm_raw else []
    vm_by_slug = {p["slug"]: p for p in vm}

    pal_raw = cr.fetch(cr.PALOMAR, "Palomar registry")
    pal = json.loads(pal_raw).get("entries", []) if pal_raw else []

    # Same shapes check-registries builds its haystacks from, so the matcher behaves
    # identically in both scripts.
    vm_pool = [(p.get("name") or p["slug"],
                f"https://vibemathed.com/problem/{p['slug']}",
                p.get("name") or p["slug"]) for p in vm]
    pal_pool = []
    for it in pal:
        repo = (it.get("source") or {}).get("repository") or ""
        names = (it.get("formalization") or {}).get("theorem_names") or []
        pal_pool.append((repo or it["id"],
                         f"https://palomar-registry.org/entry?id={it['id']}"
                         f"&version={it.get('version', 1)}",
                         re.sub(r"([a-z0-9])([A-Z])", r"\1 \2",
                                repo.split("/")[-1] + " " + " ".join(names))))
    md_pool = []
    for sm in cr.MATHDB_SITEMAPS:
        body = cr.fetch(sm, sm.rsplit("/", 1)[-1])
        if not body:
            continue
        for url in re.findall(r"<loc>([^<]+)</loc>", body):
            slug = url.rsplit("/", 1)[-1]
            md_pool.append((slug.replace("-", " "), url, slug))
    pa_pool = []
    pa_raw = cr.fetch(cr.PROOFATLAS_SITEMAP, "ProofAtlas sitemap")
    if pa_raw:
        for url in re.findall(r"<loc>([^<]+)</loc>", pa_raw):
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            if "/formalizations/" in url and slug != "formalizations":
                pa_pool.append((slug.replace("-", " "), url, slug.replace("-", " ")))

    pools = {"vibemathed": vm_pool, "mathdb": md_pool,
             "palomar": pal_pool, "proofatlas": pa_pool}
    weights = {k: cr.idf(v) for k, v in pools.items()}

    status = (label_drift(entries, vm_by_slug)
              + arxiv_status(cr, entries)
              + registrations_available(cr, entries, pools, weights, a.min_words))
    # A retraction and a coincidental one-word slug match are both "status changes", and
    # the whole point of the confidence label is that they should not be read in the order
    # the checks happened to run.
    RANK = {"high": 0, "medium": 1, "low": 2}
    status.sort(key=lambda r: (RANK.get(r.get("confidence"), 3), r["kind"], r.get("entry", "")))
    fresh = new_candidates(cr, entries, vm, pal, cutoff, a.min_significance)

    facts = {
        "generated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "window_days": a.days,
        "cutoff": cutoff,
        "filters": {"min_significance": a.min_significance, "min_words": a.min_words},
        "registry": {
            "entries": len(entries),
            "newest_date": max(e["date"] for e in entries),
            "newest_added": max(e["added"] for e in entries),
        },
        "sources_read": {"vibemathed": len(vm), "palomar": len(pal),
                         "mathdb": len(md_pool), "proofatlas": len(pa_pool)},
        "status_changes": status,
        "new_candidates": fresh,
    }

    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump(facts, fh, indent=2, ensure_ascii=False)

    if not a.quiet:
        s = facts["sources_read"]
        print("  vibemathed: %d - palomar: %d - mathdb: %d - proofatlas: %d\n"
              % (s["vibemathed"], s["palomar"], s["mathdb"], s["proofatlas"]))
        print("%d status change(s) on %d entries, %d new candidate(s) since %s\n"
              % (len(status), len(entries), len(fresh), cutoff))
        for r in status:
            if r["kind"] == "registration_available":
                print("  %-9s %-38s %s: %s (%.2f)"
                      % (r["confidence"], r["entry"], r["registry"],
                         r["candidate"][:40], r["score"]))
            else:
                print("  %-9s %-38s %s: %s"
                      % (r["confidence"], r["entry"], r["signal"], r["observed"][:70]))
        if fresh:
            print()
        for r in fresh[:25]:
            bulk = r.get("repo_registrations_in_window") or 1
            note = ("  [%d from this repo]" % bulk) if bulk > 2 else ""
            print("  %s  %-10s sig %-4s %s%s"
                  % (r["date"], r["registry"], r.get("significance") or "-",
                     str(r["title"])[:52], note))
        if len(fresh) > 25:
            print("  ... and %d more, all of them in the JSON" % (len(fresh) - 25))
        print("\nNothing was written to the registry. This is a reading, not a change.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
