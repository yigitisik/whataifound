#!/usr/bin/env python3
"""Rebuild everything from data/entries.json. This is the only command you need.

    python3 scripts/build.py

Adding, editing or removing a finding is: edit data/entries.json, run this, commit.
No HTML is ever edited by hand. This runs, in order:

    build-site.py       validates the data, pre-renders index.html, writes finding/,
                        llms.txt and sitemap.xml
    build-feed.py       regenerates feed.xml and feed.json
    verify-parity.py    asserts the pre-rendered cards still match app.js's card()
    check-integrity.py  asserts the deployed HTML contains no smuggled scripts,
                        handlers, origins or executable URL schemes

Any step failing stops the run, so a bad entry never reaches a commit. verify-parity
needs Node; if it is missing the build still succeeds and the check is reported as
skipped, since it guards a developer-side invariant rather than the output itself.

build-notability.py is deliberately not included: it calls the live Wikipedia API and
writes measured values back into data/entries.json, so it is a separate, deliberate
step rather than part of every rebuild. Run it when adding an entry with a `wikipedia`
title, then run this.
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = [
    ("build-site.py", "pre-render site", True),
    ("build-feed.py", "generate feeds", True),
    ("verify-parity.py", "verify render parity", False),
    ("check-integrity.py", "check for smuggled markup", False),
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
