#!/usr/bin/env python3
"""Suggest cross-registry links for entries that have none. Never writes any.

Four projects now record neighbouring facts about the results in this registry, and an
entry that cites the right one is worth more than an entry that does not. Finding the
match by hand means searching four sites per entry, which is why most entries do not
carry one. All four are read here: vibemathed and MathDB by problem name, Palomar by
repository and Lean theorem name, ProofAtlas by formalization slug.

This prints candidates. It does not add them, and that is deliberate: a naive title match
against vibemathed's dataset paired "Counterexamples to the Gaussian moments conjecture"
with the Jacobian conjecture, confidently. A registration is the strongest evidence an
entry can carry, so the failure mode of an automatic linker is the expensive kind. Open
both records, then edit data/entries.json by hand.

Outside build.py, like check-links.py, because it hits the network.

    python3 scripts/check-registries.py                 # entries with no registration
    python3 scripts/check-registries.py --all           # every mathematics entry
    python3 scripts/check-registries.py --min 0.5       # one threshold for every registry

Exit status is 0 whether or not it finds anything: a missing cross-link is a gap to fill,
not a broken build.

Known limit, so the output is not read as coverage: it matches words, so it misses a pair
that names the same thing differently. Our "Asymptotic degree-diameter problem resolved for
fixed diameter" and vibemathed's "Asymptotically attaining the Moore bound" are the same
result and share no word at all. On the fourteen pairs confirmed by hand it surfaces
thirteen. Whatever it does not print still has to be looked for.

Second known limit: Palomar registers a repository, not a result, so one result can hold
several registrations and one repository can cover work this registry files separately.
Two of the nineteen are lemmas from a campaign on the plane Jacobian conjecture, which is
open, and they rank against our dimension-three counterexample entry because both are
about Jacobians. Read a Palomar row as a repository to open, never as a match.
"""
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "entries.json")

VIBEMATHED = "https://vibemathed.com/api/dataset"
MATHDB_SITEMAPS = [f"https://mathdb.com/sitemap-problems-{i}.xml" for i in (1, 2, 3, 4)]
# Not linked from Palomar's own pages; it is what the homepage reads to render its list.
PALOMAR = "https://data.palomar-registry.org/recent.json"
# ProofAtlas has no API. Its sitemap carries five kinds of page and only one of them is a
# formalization record: /collaboration/ is an open problem someone is working on, so
# /collaboration/riemann-hypothesis/ exists and is not a result. Take /formalizations/
# only, which is what the vocabulary means by what this registry certifies.
PROOFATLAS_SITEMAP = "https://www.proofatlas.ai/sitemap.xml"
UA = "whataifound.org registry cross-reference (+https://whataifound.org)"

# Below this, a shared word or two is coincidence rather than a lead. Tuned on the
# backfilled entries: every hand-verified match scored at or above it, and the known false
# positives sat under it. It is a floor for what is worth a human opening two tabs, not a
# confidence score.
MIN_SCORE = 0.60

# Palomar is scored against a repository name and Lean theorem identifiers rather than
# against a problem name, so its candidate text always carries tokens no title of ours can
# match: the author's handle, "comparator", "lean", the module path. That drags every real
# pair below a floor tuned for problem names without changing the ranking, which stays
# decisive. Over the four pairs confirmed by hand, against all 19 registrations and every
# mathematics entry: 0.30 loses the unit-distance pair, 0.20 keeps all four but prints nine
# strays, and 0.25 keeps all four with three. ProofAtlas is slug-named like MathDB and
# needs no adjustment.
FLOOR = {"palomar": 0.25}

# A cheap pre-filter, not the real defence: idf() already drives common words toward
# nothing, and recall is identical with this list cut to bare function words. It stays
# because it keeps the printed overlap counts honest about which words actually matched.
STOP = {"the", "and", "for", "with", "conjecture", "problem", "problems", "proved",
        "from", "that", "all", "every", "new", "open", "case", "cases", "result",
        "results", "theorem", "bound", "bounds", "question"}


def trust_store():
    """A context that verifies, on a machine whose system trust store is empty.

    A python.org build on macOS ships no certificates until someone runs Install
    Certificates.command, so a bare create_default_context() fails every fetch here with
    CERTIFICATE_VERIFY_FAILED. That surfaced as "vibemathed: 0 records" and exit 0, which
    reads like full coverage with nothing to report rather than like a broken run. Prefer
    certifi's bundle when it is importable and fall back to the system one, so the trust
    store this depends on stays visible rather than differing per machine.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch(url, what):
    ctx = trust_store()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45, context=ctx) as r:
            return r.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"  could not read {what}: {exc}", file=sys.stderr)
        return None


def toks(s):
    return {w for w in re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).split()
            if len(w) > 2} - STOP


def idf(haystack):
    """How rare each word is across the pool, so a rare one counts for more.

    Over 66,736 MathDB slugs, "graph" is nearly free and "sabidussi" is nearly decisive.
    Unweighted overlap treats them the same and buries the real match under a hundred
    problems that happen to be about graphs.
    """
    import math
    df = {}
    for _, _, text in haystack:
        for w in toks(text):
            df[w] = df.get(w, 0) + 1
    n = max(len(haystack), 1)
    return {w: math.log(n / c) + 1.0 for w, c in df.items()}


def candidates(title_toks, haystack, weights, floor=None):
    """Score by how much of the candidate's own name our title accounts for, IDF-weighted.

    Two decisions here, both learned from getting it wrong:

    Match against our *title*, never the claim. A title states the subject; a claim
    mentions context. The claim on "Counterexamples to the Gaussian moments conjecture"
    says the conjecture was a proposed route to proving the Jacobian conjecture, and a
    claim-based match paired that entry with the Jacobian conjecture at full confidence.

    Match against the candidate's name, never an abbreviated short form. vibemathed's
    short name for Sendov is "Sendov's Conj.", whose "conj" is a token nothing will ever
    match, and it dragged a perfect match below the threshold.

    Asymmetric on purpose: scoring against the candidate asks whether we say what that
    record's name says, rather than rewarding a long title for containing common words.
    """
    out = []
    for label, url, text in haystack:
        t = toks(text)
        if not t:
            continue
        hit = title_toks & t
        total = sum(weights.get(w, 1.0) for w in t)
        score = sum(weights.get(w, 1.0) for w in hit) / total if total else 0.0
        if score >= (MIN_SCORE if floor is None else floor):
            out.append((score, len(hit), label, url))
    out.sort(key=lambda x: (-x[0], -x[1]))
    return out


def main():
    show_all = "--all" in sys.argv
    global MIN_SCORE
    # --min overrides every registry, including the ones with their own floor, so
    # that one flag still means one threshold for the whole run.
    override = None
    if "--min" in sys.argv:
        MIN_SCORE = override = float(sys.argv[sys.argv.index("--min") + 1])
    floors = {r: (override if override is not None else FLOOR.get(r, MIN_SCORE))
              for r in ("vibemathed", "mathdb", "palomar", "proofatlas")}

    entries = json.load(open(DATA, encoding="utf-8"))

    print("Reading vibemathed, MathDB, Palomar and ProofAtlas...")
    vm_raw = fetch(VIBEMATHED, "vibemathed dataset")
    vm = []
    if vm_raw:
        for p in json.loads(vm_raw).get("problems", []):
            vm.append((p.get("name") or p["slug"],
                       f"https://vibemathed.com/problem/{p['slug']}",
                       p.get("name") or p["slug"]))

    md = []
    for sm in MATHDB_SITEMAPS:
        body = fetch(sm, sm.rsplit("/", 1)[-1])
        if not body:
            continue
        for url in re.findall(r"<loc>([^<]+)</loc>", body):
            slug = url.rsplit("/", 1)[-1]
            md.append((slug.replace("-", " "), url, slug))
    # Palomar records a repository, not a problem name, so the text to match on is the
    # repository basename plus its theorem names rather than the abstract. The abstracts
    # run to paragraphs, and candidates() scores against the candidate's own name, so an
    # abstract would bury a real match under its own vocabulary. teorth/sendov becomes
    # "sendov SendovConjecture.phelps_rodriguez" and lands where it should.
    pal = []
    pal_raw = fetch(PALOMAR, "Palomar registry")
    if pal_raw:
        for it in json.loads(pal_raw).get("entries", []):
            repo = (it.get("source") or {}).get("repository") or ""
            names = (it.get("formalization") or {}).get("theorem_names") or []
            text = repo.split("/")[-1] + " " + " ".join(names)
            pal.append((repo or it["id"],
                        f"https://palomar-registry.org/entry?id={it['id']}"
                        f"&version={it.get('version', 1)}",
                        re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)))

    pa = []
    pa_raw = fetch(PROOFATLAS_SITEMAP, "ProofAtlas sitemap")
    if pa_raw:
        for url in re.findall(r"<loc>([^<]+)</loc>", pa_raw):
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            if "/formalizations/" in url and slug != "formalizations":
                pa.append((slug.replace("-", " "), url, slug.replace("-", " ")))

    print(f"  vibemathed: {len(vm)} records · MathDB: {len(md)} problems · "
          f"Palomar: {len(pal)} registrations · ProofAtlas: {len(pa)} formalizations\n")
    if not (vm or md or pal or pa):
        return 0
    weights = {"vibemathed": idf(vm), "mathdb": idf(md),
               "palomar": idf(pal), "proofatlas": idf(pa)}

    # Only mathematics: every one of these projects is mathematics only, so proposing a
    # MathDB page for a protein-design entry would be noise by construction.
    pool = [e for e in entries if e.get("field") == "mathematics"]
    shown = skipped = 0
    for e in sorted(pool, key=lambda x: x["id"]):
        have = {r.get("registry") for r in (e.get("registrations") or [])}
        needle = toks(e["title"])
        rows = []
        for name, pool_ in (("vibemathed", vm), ("mathdb", md),
                            ("palomar", pal), ("proofatlas", pa)):
            if name in have and not show_all:
                continue
            for score, hits, label, url in candidates(
                    needle, pool_, weights[name], floors[name])[:3]:
                rows.append((score, hits, name, label, url))
        if not rows:
            if not have:
                skipped += 1
            continue
        shown += 1
        print(f"{e['id']}\n  ours: {e['title']}")
        if have:
            print(f"  already linked: {', '.join(sorted(have))}")
        for score, hits, name, label, url in sorted(rows, key=lambda x: -x[0]):
            print(f"    {score:.2f} ({hits}w)  {name:11s} {label[:52]}")
            print(f"          {url}")
        print()

    print(f"{shown} entr{'y' if shown == 1 else 'ies'} with candidates above "
          f"{MIN_SCORE:.2f}; {skipped} with no candidate at that threshold.")
    print("Nothing was written. Open both records before adding a registration:")
    print("  a wrong cross-link is worse than a missing one.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
