# Governance

This project aims to be run by four or five maintainers rather than one. This document says what
that role is, how someone reaches it, and which decisions a single maintainer may not make alone.

The registry's only asset is that its grades can be trusted. Every rule below exists to protect
that, and nothing else.

## Roles

| Role | What it means | How you get there |
|---|---|---|
| **Contributor** | Opened a merged PR, or filed a grade challenge or independent check that was accepted. | Do it once. No invitation needed. |
| **Reviewer** | Trusted to review other people's entry PRs. Reviews carry weight; a maintainer merging against a reviewer's objection has to say why. | Three accepted independent checks, or five merged entries, and a track record of citing sources rather than asserting. Invited by a maintainer. |
| **Maintainer** | Merge rights. Listed as an author in [CITATION.cff](CITATION.cff) and shown on the contributors page. Shares the operational load below. | Sustained work as a reviewer, plus agreement of the existing maintainers. Not a reward for volume: the bar is judgment about evidence. |

Credit is not symbolic. A maintainer is an author of a citable dataset, and `CITATION.cff` is
edited in the same PR that adds them.

## What one maintainer may merge alone

Alone:

- A new entry that goes in at `claimed` or another grade the evidence plainly supports.
- Any change that lowers a `verification` grade, or adds a caveat.
- Typos, styling, tooling, docs.

**Needs a second maintainer:**

- **Any PR that raises a `verification` or `autonomy` grade.** An upgrade is the shape a
  promotional edit takes, and it is the one direction that costs the registry credibility if it is
  wrong. Requires new evidence, cited in the PR.
- **Any PR touching a maintainer's own work, or their employer's.** Contributing your own result is
  welcome and expected; grading it yourself is not. Declare the conflict in the PR and let someone
  else merge.
- Changes to the grading vocabulary (`data/vocab.json`), the editorial rules, or this file.
- Anything touching `scripts/`, `.github/`, `app.js` or `vercel.json` in a PR that also changes
  `data/entries.json`. CI already warns on this; treat it as a code change, never as an entry.

## Settling disagreement about a grade

The weaker grade stands until the disagreement is resolved. This is the same rule contributors
already follow ("both grades set to the weaker reading when arguable"), applied to maintainers.

If maintainers cannot agree, the entry keeps the lower grade and the objection goes in `caveats`
with its citation. A disputed record that says so is worth more than a confident one that is wrong.
Entries are never deleted to end an argument.

## Operational access

Co-ownership is not real while one person holds every key. Current state and intent:

| Asset | Today | For co-ownership |
|---|---|---|
| Repository | Single owner | Maintainers get write; admin stays with the owner initially |
| Vercel project | Single account | Maintainers added to the project so a deploy is not blocked on one person |
| Domain and DNS | Single owner | Documented, transferable; not shared by default |
| Merge protection | None | Require a passing build and one approving review on `main` |

Anyone accepting a maintainer role should be told exactly which of these they get and which they do
not, before they accept.

## Leaving

Say so in an issue or privately. Maintainers who step down move to reviewer, keep their authorship
in `CITATION.cff` for the versions they helped build, and lose merge rights. Inactivity is not
misconduct; a maintainer inactive for six months may be moved to reviewer by the others, and can
come back by asking.

## Changing this document

A PR, and agreement of the maintainers. If there is only one maintainer, changes here should still
go through a PR so the reasoning is on the record for whoever joins next.
