#!/usr/bin/env python3
"""Generate docs/entry.schema.json from data/vocab.json.

Editing data/entries.json by hand is the first thing a new contributor does and the
easiest thing to get subtly wrong. A JSON Schema gives them autocomplete and inline
errors in any editor that speaks it, before the build ever runs.

It is generated rather than written because the grade enums have to match the vocabulary
exactly. A hand-written schema would be a fourth place a grade slug is spelled out, and
it would rot the first time one changed. This is the same reason app.js's label tables
and the methodology page are generated.

    python3 scripts/build-schema.py            # write it
    python3 scripts/build-schema.py --check    # fail if it is stale (for CI)

Run from build.py, so the schema cannot fall behind the vocabulary.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "entry.schema.json")

vocab = json.load(open(os.path.join(ROOT, "data", "vocab.json"), encoding="utf-8"))
VER = [v["slug"] for v in vocab["verification"]]
AUT = [a["slug"] for a in vocab["autonomy"]]
FIELDS = sorted(vocab["fields"])


def described(slugs, items):
    """An enum plus a human-readable gloss, so an editor can explain each choice."""
    by = {i["slug"]: i for i in items}
    return "One of: " + "; ".join(f"`{s}` {by[s].get('short', '')}".strip() for s in slugs)


PERSON = {
    "type": "object",
    "required": ["name"],
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string", "minLength": 1,
                 "description": "As it should appear as credit."},
        "github": {"type": "string", "pattern": "^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$",
                   "description": "Bare handle, no @. Becomes a link. Optional."},
        "note": {"type": "string", "description": "What they did, e.g. 'verified the Lean proof'."},
    },
}

LABELLED = {
    "type": "object",
    "required": ["label", "url"],
    "additionalProperties": False,
    "properties": {
        "label": {"type": "string", "minLength": 1},
        "url": {"type": "string", "pattern": "^https?://",
                "description": "Must be http(s). Other schemes are rejected by the build."},
    },
}

# A source is a labelled link plus what kind of link it is. `discussion` keeps the plain
# LABELLED shape: a forum thread is not evidence and is not classified. Kept as a separate
# object rather than an extra key on LABELLED because additionalProperties is False, so
# adding `kind` there would let a discussion entry carry one.
SRC_KINDS = [k["slug"] for k in vocab["source_kinds"]]
SOURCE = {
    "type": "object",
    "required": ["label", "url", "kind"],
    "additionalProperties": False,
    "properties": {
        **LABELLED["properties"],
        "kind": {"type": "string", "enum": SRC_KINDS,
                 "description": described(SRC_KINDS, vocab["source_kinds"])},
    },
}

schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://whataifound.org/entry.schema.json",
    "title": "whataifound.org registry entry",
    "description": ("One finding in data/entries.json. Generated from data/vocab.json by "
                    "scripts/build-schema.py: do not hand-edit. See docs/SCHEMA.md."),
    "type": "array",
    "items": {
        "type": "object",
        "required": ["id", "title", "claim", "field", "date", "lab", "model",
                     "verification", "autonomy", "sources", "added"],
        "additionalProperties": False,
        "properties": {
            "id": {"type": "string", "pattern": "^[a-z0-9][a-z0-9._-]*$",
                   "description": "Stable slug, never reused. YYYY-MM-DD-short-name."},
            "title": {"type": "string", "minLength": 1,
                      "description": "Plain and factual. No hype verbs."},
            "claim": {"type": "string", "minLength": 1,
                      "description": "One sentence a smart non-expert can read."},
            "field": {"type": "string", "enum": FIELDS,
                      "description": "A new value needs a display name in data/vocab.json."},
            "date": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
                     "description": "ISO date the result became public."},
            "lab": {"type": "string", "description": "Organization credited. 'Independent' if none."},
            "model": {"type": "string", "description": "Model + version. 'Unknown' if not disclosed."},
            "verification": {"type": "string", "enum": VER,
                             "description": described(VER, vocab["verification"])},
            "autonomy": {"type": "string", "enum": AUT,
                         "description": described(AUT, vocab["autonomy"])},
            "sources": {"type": "array", "minItems": 1, "items": SOURCE,
                        "description": ("Every link, each labelled with what it is. At least one "
                                        "'research' source is required for any grade stronger "
                                        "than 'claimed'. Most significant first within a kind.")},
            "added": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
                      "description": "ISO date this entry was added to the registry."},

            "humans": {"type": "array", "items": {"type": "string"},
                       "description": "Named human collaborators on the discovery."},
            "year_posed": {"type": "integer",
                           "description": "Year the problem was first posed. Omit if there is no single origin year."},
            "detail": {"type": "string", "description": "2-5 sentences. What was actually new."},
            "novelty_check": {"type": "string",
                              "description": "What was searched and what turned up. Write it even when clean."},
            "caveats": {"type": "string", "description": "Known objections, disputes, unreplicated parts."},
            "independent_checks": {
                "type": "array",
                "description": "What was checked, by whom, and with what outcome.",
                "items": {"type": "object", "required": ["who", "outcome"],
                          "additionalProperties": False,
                          "properties": {"who": {"type": "string"},
                                         "outcome": {"type": "string"},
                                         "url": {"type": "string", "pattern": "^https?://"}}}},
            "discussion": {"type": "array", "items": LABELLED,
                           "description": "Threads where the result was debated. Not a substitute for a source."},
            "videos": {"type": "array",
                       "items": {"type": "object", "required": ["label", "channel", "youtube_id"],
                                 "additionalProperties": False,
                                 "properties": {"label": {"type": "string"},
                                                "channel": {"type": "string"},
                                                "youtube_id": {"type": "string",
                                                               "pattern": "^[A-Za-z0-9_-]{11}$"}}},
                       "description": "Credible explainers only. Verify the ID resolves."},
            "tags": {"type": "array", "items": {"type": "string"}},
            "contributors": {"type": "array", "items": PERSON,
                             "description": "Who added or corrected this registry entry."},
            "reviewers": {"type": "array", "items": PERSON,
                          "description": "Who independently checked it. Pairs with independent_checks."},
        },
    },
}

text = json.dumps(schema, indent=2, ensure_ascii=False) + "\n"

if "--check" in sys.argv:
    current = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
    if current != text:
        sys.exit("entry.schema.json is stale. Run: python3 scripts/build-schema.py")
    print("entry.schema.json is up to date.")
else:
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Wrote docs/entry.schema.json ({len(VER)} verification, {len(AUT)} autonomy, "
          f"{len(FIELDS)} fields).")
