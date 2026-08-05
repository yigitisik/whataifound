#!/usr/bin/env python3
"""Rebuild everything from data/entries.json. This is the only command you need.

    python3 scripts/build.py

Adding, editing or removing a finding is: edit data/entries.json, run this, commit.
No HTML is ever edited by hand. This runs, in order:

    build-site.py       validates the data, pre-renders index.html, writes finding/,
                        llms.txt and sitemap.xml
    build-feed.py       regenerates feed.xml and feed.json
    verify-parity.py    asserts the pre-rendered cards still match app.js's card()
    verify-doors.py     asserts the GitHub issue templates and /contribute ask the
                        same questions, so a contribution does not depend on route
    check-integrity.py  asserts the deployed HTML contains no smuggled scripts,
                        handlers, origins or executable URL schemes
    check-mobile.py     asserts the site still behaves on a phone: hover states that
                        do not stick to a tap, 44px touch targets, safe areas, and
                        nothing that overflows a 375px screen

Any step failing stops the run, so a bad entry never reaches a commit. verify-parity
needs Node; if it is missing the build still succeeds and the check is reported as
skipped, since it guards a developer-side invariant rather than the output itself.

"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = [
    ("build-site.py", "pre-render site", True),
    ("build-feed.py", "generate feeds", True),
    # Regenerated every build so the editor schema cannot fall behind data/vocab.json.
    ("build-schema.py", "regenerate entry schema", True),
    ("verify-parity.py", "verify render parity", False),
    ("verify-doors.py", "verify both contribution doors match", False),
    ("check-integrity.py", "check for smuggled markup", False),
    # Last, and on the same footing as the other two verifiers: a mobile regression is
    # invisible to whoever introduces it, because the site is written on a desktop.
    ("check-mobile.py", "check mobile ergonomics", False),
]


def main():
    failed = False
    for script, what, required in STEPS:
        if script == "verify-parity.py" and not shutil.which("node"):
            print(f"- {what}: skipped (Node not installed)")
            continue
        # flush: this process's stdout is block-buffered when piped, while the child
        # writes straight to the terminal, and without it every header appears after all
        # the output it was meant to label.
        print(f"- {what} ({script})", flush=True)
        r = subprocess.run([sys.executable, os.path.join(HERE, script)])
        if r.returncode != 0:
            if required:
                sys.exit(f"\nBuild failed in {script}. Nothing further was run.")
            failed = True
    if failed:
        sys.exit("\nBuild produced output but a check failed. See above.")
    print("\nBuild complete. Review `git status`, then commit.")


if __name__ == "__main__":
    main()
