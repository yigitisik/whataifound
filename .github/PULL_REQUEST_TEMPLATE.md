<!--
Thanks for contributing. Delete whichever section does not apply.

One entry or one code change per PR. An entry PR should touch data/entries.json plus the
files the build regenerates, and nothing else; CI warns when it also touches scripts/,
.github/, app.js or vercel.json, and those are reviewed as code regardless of the entry.
-->

## What this changes

<!-- One or two sentences. For an entry, name the finding and the grades it goes in at. -->

## Entry changes

Delete this section for a code-only PR.

- [ ] I ran `python3 scripts/build.py` and committed everything it regenerated
- [ ] At least one **primary** source (paper, proof artifact, dataset, repository). A news article is not one
- [ ] `novelty_check` names what was searched and what turned up, not "appears novel". A database and a query, e.g. "MathSciNet + arXiv, dimension-3 constructions; nearest is Wang 1980 (degree 2 only)"
- [ ] Both grades set to the **weaker** reading where arguable, with the tension noted in `caveats`
- [ ] No hype verbs in the title

**Grades and why:**

<!--
verification: <slug>, because ...
autonomy:     <slug>, because ...
An upgrade to an existing entry needs new evidence, cited here, and a second maintainer.
-->

**Conflict of interest:** <!-- Are you an author of this result, or at the lab that announced it?
Contributing your own work is welcome and common. Say so; it goes in at the grade the evidence
supports either way. "None" is a fine answer. -->

## Code changes

Delete this section for an entry-only PR.

- [ ] Changed `card()`? Then I changed it in **both** `app.js` and `scripts/build-site.py` (`verify-parity.py` fails otherwise)
- [ ] No new runtime external requests; anything new has its CSP directive in `vercel.json`
- [ ] No inline event handlers; listeners attach in `app.js`
- [ ] WCAG 2.1 AA held: focus rings, heading order, chart labels, `prefers-reduced-motion`
- [ ] Works in light and dark, and holds at 320 / 560 / 720px

## For the reviewer

Automation covers the mechanical part. None of it can tell whether a claim is true.

- [ ] **Opened the primary sources.** CI confirms they resolve; only a human confirms they say what the entry says they say. A plausible URL to a real paper that does not contain the result is the likeliest bad entry, and no check catches it
- [ ] **Checked the grades against the evidence**, not against the contributor's summary. `formal` needs a machine-checked artifact you can point at; `independent` needs someone who is not an author
- [ ] **Read `novelty_check` as a claim about searching**, not as a conclusion
- [ ] **Treated the diff's scope as a signal.** Entry PR touching `scripts/`, `.github/`, `app.js` or `vercel.json` is a code change
- [ ] This PR raises a grade, or touches a maintainer's own work → **a second maintainer approved it** ([GOVERNANCE.md](../GOVERNANCE.md))
