#!/usr/bin/env python3
"""Check that both contribution doors ask the same questions.

    python3 scripts/verify-doors.py

A contribution can arrive two ways: a GitHub issue template under
.github/ISSUE_TEMPLATE/, or the form on /contribute. docs/CONTRIBUTING.md promises they
"ask the same questions field for field", and GOVERNANCE.md rests on it: if one door
collects less than the other, then which door a contributor used changes what the
registry ends up recording, and the grades stop being comparable.

Nothing enforced that promise, and it had already broken in four places when this check
was written:

  * `outcome` was a four-option dropdown on GitHub and free prose on the web. None of
    the 23 outcomes actually in data/entries.json match those four options, so the
    dropdown produced a value a maintainer had to rewrite by hand while the web form
    produced the value verbatim.
  * The web form accepted a `url` for a check. The GitHub template had no such field,
    even though `independent_checks[].url` is in the schema.
  * The GitHub challenge offered a "Both" axis. The web form did not, so the same
    argument was expressible on one door and not the other.
  * The GitHub challenge asked for conflicts of interest. The web form did not.

This is the cheap version of verify-parity.py for the two front doors: it does not
render anything, it just diffs the field sets and the vocabularies.

No YAML parser: the repository has no Python dependencies and these templates are
simple enough to read with a regex. Exits non-zero and names the mismatch.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES = os.path.join(ROOT, ".github", "ISSUE_TEMPLATE")


def parse_template(name):
    """Field id -> {"required": bool, "options": [...]} from a GitHub issue form."""
    path = os.path.join(TEMPLATES, name)
    src = open(path, encoding="utf-8").read()
    fields = {}
    # Split on the list markers so each chunk holds exactly one field.
    for chunk in re.split(r"\n  - type:", src)[1:]:
        m = re.search(r"^\s*id:\s*(\S+)", chunk, re.M)
        if not m:
            continue          # a markdown block: guidance, not a question
        opts = []
        om = re.search(r"^\s*options:\n((?:\s*-\s.*\n)+)", chunk, re.M)
        if om:
            opts = [re.sub(r"^\s*-\s*", "", ln).strip()
                    for ln in om.group(1).splitlines() if ln.strip()]
        fields[m.group(1)] = {
            "required": bool(re.search(r"required:\s*true", chunk)),
            "options": opts,
        }
    return fields


def web_fields(kind):
    """Field name -> required, for one kind of submission on /contribute.

    Read from two places that must agree with each other as well: the markup states
    which controls exist, and api/_lib/proposals.js states which of them are required.
    A field present in the form but absent from the validator is not a question, it is
    decoration, so the validator is what this trusts for `required`.
    """
    html = open(os.path.join(ROOT, "contribute.html"), encoding="utf-8").read()
    # The fieldset for this kind, so a field on another tab is not counted here.
    fm = re.search(r'<fieldset[^>]*data-for="%s"(.*?)</fieldset>' % re.escape(kind),
                   html, re.S)
    if not fm:
        return None, f'contribute.html has no <fieldset data-for="{kind}">'
    block = fm.group(1)
    present = set(re.findall(r'\bid="f-([A-Za-z_]+)"', block))

    js = open(os.path.join(ROOT, "api", "_lib", "proposals.js"), encoding="utf-8").read()
    vm = re.search(r"function validate%s\(p[^)]*\)\s*\{(.*?)\n\}" % kind.capitalize(),
                   js, re.S)
    if not vm:
        return None, f"api/_lib/proposals.js has no validate{kind.capitalize()}()"
    body = vm.group(1)
    # `required: false` marks an optional url; a bare text()/url() call is required.
    optional = set(re.findall(r'\bp\.(\w+),\s*"[^"]+",\s*\{\s*required:\s*false', body))
    optional |= set(re.findall(r"p\.(\w+)\s*\?\s*text\(", body))   # the `p.coi ? ...` form
    read = set(re.findall(r"\bp\.(\w+)", body))
    return {"present": present, "read": read, "optional": optional}, None


def main():
    problems = []

    # ---- independent check -------------------------------------------------
    gh = parse_template("independent-check.yml")
    web, err = web_fields("check")
    if err:
        problems.append(err)
    else:
        # `entry` is asked by the picker outside the fieldset on the web, and by a
        # prefilled input on GitHub. Both ask it; it is just not inside the block.
        gh_asked = set(gh) - {"entry"}
        web_asked = {"who", "outcome", "evidence", "coi", "url"} & (web["read"] | web["present"])
        for missing in sorted(gh_asked - web_asked):
            problems.append(f"check: GitHub asks '{missing}', /contribute does not")
        for missing in sorted(web_asked - gh_asked):
            problems.append(f"check: /contribute asks '{missing}', the GitHub template does not")
        # A vocabulary on one door and free text on the other means the two produce
        # values that cannot be compared, which is the failure this check exists for.
        for fid, spec in gh.items():
            if spec["options"] and fid in web_asked:
                problems.append(
                    f"check: GitHub constrains '{fid}' to {spec['options']} but "
                    f"/contribute takes free text. Either both constrain it or neither "
                    f"does, or the same submission yields different data per door.")

    # ---- grade challenge ---------------------------------------------------
    gh = parse_template("grade-challenge.yml")
    web, err = web_fields("challenge")
    if err:
        problems.append(err)
    else:
        # Field names differ by design: GitHub folds the argument into `citation` and
        # conflicts into `notes`, the web form splits them. Compare what is asked, not
        # what it is called.
        gh_concepts = set()
        for fid in gh:
            gh_concepts.add({"entry": "entry", "current": "entry", "axis": "axis",
                             "proposed": "proposed", "citation": "citation",
                             "notes": "coi"}.get(fid, fid))
        web_concepts = {"entry", "axis", "proposed", "citation"}
        if "coi" in (web["read"] | web["present"]):
            web_concepts.add("coi")
        for missing in sorted(gh_concepts - web_concepts):
            problems.append(f"challenge: GitHub asks for '{missing}', /contribute does not")

        # The axis vocabularies have to match: an option on one door that the other
        # cannot express is an argument a contributor can make only from GitHub.
        gh_axes = {o.split(" (")[0].strip().lower() for o in gh.get("axis", {}).get("options", [])}
        web_axes = set(re.findall(r'<option value="(verification|autonomy)"',
                                  open(os.path.join(ROOT, "contribute.html"),
                                       encoding="utf-8").read()))
        for extra in sorted(gh_axes - web_axes):
            problems.append(
                f"challenge: the GitHub template offers axis '{extra}' which /contribute "
                f"cannot express. Every axis must exist on both doors.")

    if problems:
        print(f"Door parity failed with {len(problems)} mismatch(es):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print("\nBoth doors must ask the same questions: docs/CONTRIBUTING.md says so, and "
              "a contribution's outcome must not depend on which one was used.",
              file=sys.stderr)
        sys.exit(1)
    print("Door parity OK: the GitHub templates and /contribute ask the same questions.")


if __name__ == "__main__":
    main()
