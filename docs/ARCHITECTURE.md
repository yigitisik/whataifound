# Architecture

Decisions that are not obvious from the code, and that someone would otherwise re-litigate.
The code itself is commented where it is surprising; this file covers the choices that span
more than one file.

## Why the site is pre-rendered

The AI crawlers `robots.txt` invites (GPTBot, ClaudeBot, PerplexityBot, CCBot) largely do not
execute JavaScript. When the page fetched its entries client-side, those crawlers got a
registry of AI discoveries containing no AI discoveries: an empty `<main>`. The entries are
now in the markup, and each finding also has its own URL for citation.

`app.js` still owns search and filtering. On first paint it *adopts* the server-rendered list
(via `data-prerendered` on `#list`) rather than rewriting it, so the DOM never churns on load.
That adoption is only correct for the pristine view: a URL carrying a filter or a sort asked
for something the pre-render is not, and must render before it is seen.

## Why `card()` exists twice

`card()` lives in both `js/app.js` and `scripts/build-site.py`. They must stay in step, or the
markup visibly changes the first time a visitor filters. `scripts/verify-parity.py` is what
enforces that: it runs the real `app.js` functions under Node and diffs each against the
pre-rendered markup, byte for byte.

Seven surfaces are checked this way: `card()`, `matrixCard()`, `tableView()`, `yearCard()`,
`topicCard()`, `evidenceCard()` and `standingCard()`. The last four were hoisted out of
`renderCharts()` into module scope precisely so a parity check could call them, since a
closure inside a function that writes to the DOM cannot be called from outside it.

`DOMAIN_NAME` and `FIELD_SHORT` are duplicated for the same reason and carry the same
obligation: a source from a host missing from that table renders as a bare domain, and an
86px chart label column cannot hold "Materials science". Adding one means adding it to both.

## What `check-integrity.py` guards

About a quarter of `index.html` (the `<head>`, most of the JSON-LD, the nav, the footer, the
script tags) sits *outside* the `<!--…:START/END-->` markers and is never regenerated. A
payload placed there survives every rebuild and leaves a clean `git diff`, so a check that
only compares against a rebuild would not see it.

The one JSON-LD block that *is* generated is the registry `ItemList`, between
`<!--HOMELD:START/END-->`. It is a mechanical projection of `data/entries.json` and has to be
rewritten whenever an entry is added, so it cannot live in the hand-written graph beside the
Organization, WebSite, Dataset and FAQPage nodes, which change by hand.

So the script asserts properties of the content instead: no unexpected inline scripts, no
script or frame origins outside the CSP, no inline event handlers, no executable URL schemes,
no `<base>`/`<object>`/`<embed>`, and no `<form>` carrying an `action`.

In CI it runs **before** the rebuild. A rebuild would otherwise overwrite tampering in a fully
generated file and hide it.

It also enforces one house-style rule, because prose is written by hand in a dozen places and
a rule something checks is worth more than a rule everybody knows: **no em dashes anywhere in
the repository**, in prose, code comments or generated output. En dashes are deliberately
untouched, because the registry is full of legitimate ones (`Navier-Stokes`, `2000-2022`,
`protein-ligand`) and a blanket sweep would corrupt content.

## Why the generated output is committed, and how it stays reviewable

Most static site generators do not commit their output; they build in CI. This one does,
and that is not an oversight. `check-integrity.py` runs on the **committed bytes, before**
CI rebuilds them, because a rebuild would overwrite tampering in a fully generated file and
leave a clean diff. The committed artifact is the thing a reviewer approves, so it has to
exist. `.github/workflows/build.yml` orders the two steps that way deliberately.

Two consequences follow, and both are handled rather than lived with.

**Every chrome change touches every page.** A one-word edit to the footer rewrites that
region on every page that carries it, which is every page the build writes. That is inherent:
there is no include mechanism in plain static HTML, and the alternatives do not fit.

- *Building on deploy* would remove the diff but break the integrity model above.
- *A separate `deploy` branch* is structurally impossible: `index.html` is simultaneously
  hand-written (the `<head>`, the editorial JSON-LD, nav, script tags) and generated (the
  marker regions). Source and output are the same file, so no branch split can separate them.
- *Hoisting the inline SVGs into a sprite* would cut the header by two thirds, but the brand
  mark is CSS-animated per page and inherits `currentColor`. Both need in-document SVG.

**So the diff is made cheap to read instead.** Two things do that:

`.gitattributes` marks `finding/`, `topic/`, `lab/` and the feeds `linguist-generated=true`,
so GitHub collapses them behind "Load diff" and a chrome PR presents as the nine files
somebody actually wrote. `index.html` is deliberately **not** marked: a quarter of it is
hand-written and outside the markers, which is exactly the region a smuggled payload would
live in.

And the shared chrome is emitted **one element per line**. It used to be one unbroken
string per function, so a one-word footer change showed as a 3,725-character line deleted
and another added, on every generated page, with no way to see what moved. Broken up, the
same change is two lines about forty characters wide. The widest line in a finding page went
from 4,346 characters to 977.

### The rule, if you add to the header or footer

Break only between children of a **flex container, a grid container, or a block-level
element**. Never between inline children.

Whitespace-only text nodes are dropped between flex and grid items and collapse between
block siblings, but between inline elements a newline renders as a space and moves the
layout. `NL` in `build-site.py` carries this note; `.updated` and the interior of every
prose `<p>` are left on one line for exactly this reason, and each says so where it is
written.

Verified against `styles.css`: `.eyebrow` flex, `.brand` inline-flex, `.pagenav`
inline-flex, `.eyebrow-right` flex, `.doors` inline-flex, `.theme-seg` inline-flex,
`.about-grid` grid, `.about-links` flex, `.about-foot` flex, `footer` and `.about-cell`
block. `.updated` has no display of its own, so its children are inline: do not break it.

## Mobile: three rules that are easy to undo by accident

The site is written and read on a desktop, so a mobile regression is invisible to whoever
introduces it. `scripts/check-mobile.py` runs in `build.py` and fails on each of these.

**Movement on hover is desktop-only; colour is not.** iOS applies `:hover` on tap and holds
it until the reader taps something else, so an unguarded lift leaves a card sitting two
pixels high with no way to put it back. The 14 rules that change `transform` or
`box-shadow` are inside `@media (hover: hover)`. The other 49, which only change colour,
are deliberately left alone: on a phone they fire on tap and read as touch feedback, which
is worth keeping. Where a selector paired `:hover` with `[open]` or `:focus-visible`, the
rule is split so the non-hover half still works on a touch screen.

**Touch targets reach 44px, by growing or by expanding.** Apple asks 44x44pt, Material
48x48dp. Controls with room take the real height. The eyebrow has none (brand, nav, the
doors segment, the theme switcher and the updated stamp share one row with no slack), so
those get a transparent `::after` that reaches 44px while the painted control keeps its
size. For the two *segmented* controls, `.doors` and `.theme-seg`, only height is taken to
44: adjacent cells cannot be given overlapping hit areas without handing the tap to the
wrong cell, and three 44px-wide theme buttons would eat a third of a 375px row.
`.pill` is excluded on purpose. It is a label, not a control.

**The phone default is a viewport answer, never a preference.** `.regtable` is
`min-width:1040px`, so the table view opens on a phone as a sideways scroll of a page meant
to be read. With no stored preference the viewport decides, and that answer is **not**
written to `localStorage`: one link opened on a phone must not put a desktop into cards
forever. Only the view toggle persists.

That rule lives in two places, the pre-paint script in `index.html` and `storedView()` in
`app.js`, for the same reason `card()` does: one has to run before paint and the other
after. They must agree, including on a malformed `?view=`, which both ignore and fall
through rather than treating as "table".

## The hero, and dates that do not rot

The home page opens on the corpus chart beside **Latest activity**, which is what has changed,
newest first. That feed exists because of editorial rule 2: the registry never deletes an
entry, it downgrades and annotates it, and until the feed existed that promise was only
observable by reading commit messages.

Each entry may carry a `revisions` array recording a regrade, a landed check, a challenge or a
correction. The build merges those with one synthesised `Added` row per entry. `added` is
reserved for the build, so an entry cannot backdate its own arrival.

**Dates in the feed are absolute, never relative.** `build-site.py` imports no clock on
purpose: the generated files are committed, and CI rebuilds them and diffs the bytes, so "3
days ago" would rot the moment nobody touched the registry for a week. For the same reason the
sort carries an explicit tiebreak (date, then the entry's own date, then id): a backfill gives
many entries the same `added` date, and an unstable order would fail CI on an unrelated pull
request.

## Accounts, and why the CSP did not have to move

Contributing used to require a GitHub account. Signing in with Google is now an alternative, so
someone who can say in a paragraph whether a proof holds can say it without a GitHub signup.

**Nothing about the static site changed.** It builds, deploys and serves exactly as before, and
with the API absent the header simply keeps showing the Google door, which reports that
accounts are not configured. The functions under `api/` are additive.

The constraint was the CSP: `default-src 'self'` with `connect-src 'self'`, and the project
rule that there are no runtime external requests. A hosted auth SDK would have meant widening
`script-src` to a third-party origin, vendoring a bundle into a repo with no bundler, and
putting a token in `localStorage` where any script can read it. So **the browser never talks to
Google or to Supabase.** The OAuth code exchange happens server-side in `api/auth/callback.js`,
and the browser gets an `HttpOnly` cookie it cannot read. `connect-src` and `script-src` are
byte for byte what they were.

The same constraint decided the avatar. `img-src` is `'self' data:`, so a Google profile photo
is blocked outright; accounts get a deterministic identicon generated from the handle as inline
SVG. New accounts get a handle from a curated wordlist in the site's own register
(`patient-lemma`, `amber-conjecture`), deliberately not the person's real name, which would
publish an identity they never chose to share.

`/account` shows progress toward the reviewer role using the bar
[GOVERNANCE.md](../GOVERNANCE.md) already defines. Stats lead with *accepted* work and an
acceptance rate rather than raw counts, because that document says the bar "is not a reward for
volume". No badges, no leaderboard, for the same reason.

Turning any of it on needs a Google OAuth client, a Postgres database and a handful of
server-side environment variables: [SETUP.md](SETUP.md).

## The two doors, rendered as two doors

CONTRIBUTING.md's framing is that there are two equal ways in: a pull request, or signing in
to submit through the UI. Three surfaces offer that choice, and all three used to render it
lopsided, each favouring a different side:

| Surface | Was | Now |
|---|---|---|
| Masthead | Bare 26px GitHub glyph beside a filled accent "Sign in" pill | One bordered segment: GitHub mark, then the Google G |
| `/contribute` | Primary "Continue with Google" button; GitHub as fine print | Two buttons of equal size in a `.door-pair` |
| Finding pages | Two UI buttons; "Or do it on GitHub" as four anonymous text links | Same buttons, with the GitHub route marked and ruled off below them |

The masthead segment is built like `.theme-seg` deliberately: a bordered group reads as one
control holding alternatives, which is what these are. It does **not** set `overflow:hidden`
the way the theme switcher does, because the right-hand cell becomes the account menu once a
session resolves and its dropdown is positioned inside it; clipping the segment would clip
the menu away. The corners are rounded per cell instead.

Both cells are 26px, so nothing reflows when `/api/me` answers: `chrome.js` swaps the Google
mark for the identicon in the same cell. The slot used to reserve 83px for a labelled button.

The Google G is the one mark on the site not drawn in `currentColor`. That is a deliberate
exception: the four-colour form is the only one Google's branding guidelines permit on a
sign-in control, and it names the provider before the click rather than after it. It is the
same geometry as `assets/external-logos/google.svg`, which the registry uses for Google as a
*lab*; the two never appear in the same row.

A bare glyph here was tried and reverted once before, on the grounds that an outlined person
icon among outlined icons read as a third toggle. That objection was to a *neutral* glyph.
These are two of the most recognisable marks on the web, and the border now says they are
actions rather than status.

## Contributing from the UI, without git becoming a second source of truth

`/contribute` takes an independent check, a grade challenge, a correction or a whole new entry,
and asks the same questions the GitHub issue templates ask, field for field. What it does not
do is write to the registry.

```
submitted in the UI  ->  a pending row in Postgres
                          (nothing public, nothing in git)
maintainer approves  ->  a GitHub App pushes submission/<uuid>
                          diff: data/entries.json, and nothing else
                     ->  rebuild-bot.yml regenerates the site on that branch
maintainer merges    ->  the registry changes, exactly as for any pull request
```

Three properties hold this together.

**Git stays canonical.** Postgres holds accounts, triage signals and pending work. Nothing in
it is load-bearing for what a reader sees: delete the database and the site is what it was,
minus the sign-in button.

**Approval, not submission, is what touches the repository.** A Gmail address is free and
unlimited, so an endpoint that pushed a branch on submit would hand anyone the ability to write
here. A maintainer's click is the gate, and the queue is capped per account.

**The bot's reach is bounded twice.** The GitHub App holds Contents and Pull requests and
nothing else, so it cannot edit workflows;
[`rebuild-bot.yml`](../.github/workflows/rebuild-bot.yml) then refuses any `submission/**`
branch whose diff touches a file other than `data/entries.json`. The first limit is
configuration, the second is code a reviewer can read. `scripts/`, `app.js` and `.github/` are
unreachable from the UI path by construction.

Triage signals are the one thing readers can do with a single click, and they are deliberately
inert: they order the review queue and do nothing else. They never enter `data/entries.json`,
never render as a score, and never move a grade, which keeps GOVERNANCE.md's "grades move on
evidence, never on opinion" literally true.

### Three things this deliberately does not have

Sign-in, per-account write caps and a signals table are already here, which makes all three of
these a short afternoon's work. That is exactly why the reasons are written down: the cost of
adding them is not what is stopping us.

**A significance score.** Every non-subjective way to build one turns out to be something the
site already does better. Deriving it from the grades is `VER_SCORE` times `AUT_RANK`, and
collapsing those two axes into one destroys the distinction the hero matrix exists to draw:
"strong evidence, barely autonomous" and "weak evidence, fully autonomous" are different
findings and would score the same. Deriving it from citation counts needs a live external
source, which `connect-src 'self'` forbids and which would rot the moment it was snapshotted.
"How long the problem stood" is the one honest proxy, and it already ships as `year_posed` and
`standingCard()`. What is left is a judgement rendered to two significant figures, and whichever
number exists becomes the sort everyone uses, which is a leaderboard wearing a different label.

**Votes.** A vote tally on a scientific claim is a rendered opinion score sitting next to a
grade, and readers reasonably take the more prominent number as the real verdict. The signals
design goes to some trouble to avoid this (counts are flags, not a score, and `js/signals.js`
declines to render a row of zeroes precisely because it would read as a scoreboard); adding
votes would spend that care.

**Comments.** Refused on architecture rather than principle. Postgres is currently not
load-bearing for anything a reader sees: delete it and the site is what it was, minus sign-in.
Comments break that, and they add a moderation surface and an untrusted-HTML path to a site
whose CSP allows `'unsafe-inline'` styles. The `discussion` array already links out to Hacker
News and Stack Exchange threads, where the moderation is someone else's job and the argument is
happening anyway.
