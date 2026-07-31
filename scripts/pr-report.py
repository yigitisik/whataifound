#!/usr/bin/env python3
"""Summarise what an entry PR changes, for the bot to post as a comment.

Reviewing an entry PR means reading tens of thousands of lines of regenerated HTML to
find the handful of fields that actually changed. This writes the summary a reviewer
needs: which entries were added, removed, or re-graded, and which grades moved.

    python3 scripts/pr-report.py BASE_REF > pr-report.md

Runs in the *untrusted* CI job (it reads PR content), so it has no repository
permissions and writes only to stdout. The privileged job that posts the comment never
executes any of this; it downloads the artifact and posts it verbatim. That split is
what keeps a malicious PR from getting a write token.

Everything interpolated here comes from the PR and is therefore attacker-controlled.
`md()` neutralises it: markdown and HTML in an entry title cannot break out of the
table cell it is printed in.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = "data/entries.json"


def md(s, limit=90):
    """Make attacker-controlled text safe to drop into a markdown table cell."""
    s = str(s or "")
    # Pipes end a cell; backticks open code spans; angle brackets allow raw HTML;
    # newlines end the row entirely. Brackets and parens would allow a fake link.
    for ch, sub in (("|", "\\|"), ("`", "'"), ("<", "&lt;"), (">", "&gt;"),
                    ("[", "("), ("]", ")"), ("\r", " "), ("\n", " ")):
        s = s.replace(ch, sub)
    s = " ".join(s.split())
    return (s[:limit] + "…") if len(s) > limit else s or "(blank)"


def load(ref):
    try:
        out = subprocess.run(["git", "show", f"{ref}:{DATA}"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
        return {e["id"]: e for e in json.loads(out)}
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "FETCH_HEAD"
    before, after = load(base), load("HEAD")
    if before is None or after is None:
        print("_Could not read `data/entries.json` on both sides; skipping entry summary._")
        return

    added = [i for i in after if i not in before]
    removed = [i for i in before if i not in after]
    changed = [i for i in after if i in before and after[i] != before[i]]

    if not (added or removed or changed):
        print("No entry changes in this PR.")
        return

    out = []
    if added:
        out.append(f"**{len(added)} entry added**" if len(added) == 1
                   else f"**{len(added)} entries added**")
        out.append("")
        out.append("| Entry | Verification | Autonomy | Sources | Checks |")
        out.append("|---|---|---|---|---|")
        for i in added:
            e = after[i]
            out.append(f"| {md(e.get('title'))} | `{md(e.get('verification'), 30)}` | "
                       f"`{md(e.get('autonomy'), 30)}` | {len(e.get('sources') or [])} | "
                       f"{len(e.get('independent_checks') or [])} |")
        out.append("")

    if changed:
        rows = []
        for i in changed:
            b, a = before[i], after[i]
            diffs = [k for k in set(b) | set(a) if b.get(k) != a.get(k)]
            grade = [k for k in ("verification", "autonomy") if k in diffs]
            note = ", ".join(f"**{k}: `{md(b.get(k), 24)}` → `{md(a.get(k), 24)}`**"
                             for k in grade)
            other = [k for k in sorted(diffs) if k not in grade]
            if other:
                note += (", " if note else "") + "also " + ", ".join(f"`{md(k, 24)}`" for k in other)
            rows.append(f"| {md(a.get('title'))} | {note} |")
        out.append(f"**{len(changed)} entr{'y' if len(changed) == 1 else 'ies'} changed**")
        out.append("")
        out.append("| Entry | What changed |")
        out.append("|---|---|")
        out.extend(rows)
        out.append("")

    if removed:
        out.append(f"⚠️ **{len(removed)} entry removed.** Entries are never deleted; "
                   "downgrade and add `caveats` instead. See docs/CONTRIBUTING.md.")
        out.append("")
        for i in removed:
            out.append(f"- {md(before[i].get('title'))}")
        out.append("")

    # Upgrades are the shape a promotional edit takes, so call them out explicitly.
    from_rank = {s: n for n, s in enumerate(
        ["refuted", "disputed", "known", "claimed", "author-verified",
         "peer-reviewed", "independent", "formal"])}
    ups = [i for i in changed
           if from_rank.get(after[i].get("verification"), -1)
           > from_rank.get(before[i].get("verification"), -1)]
    if ups:
        out.append(f"> **{len(ups)} verification upgrade{'' if len(ups) == 1 else 's'} in this PR.** "
                   "An upgrade needs new evidence cited in the PR, and a second maintainer "
                   "(GOVERNANCE.md).")
        out.append("")

    print("\n".join(out))


if __name__ == "__main__":
    main()
