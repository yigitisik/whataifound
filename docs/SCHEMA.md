# Entry Schema

Every finding is one JSON object in `data/entries.json`. The schema is the product. Everything
else (site, search, company pages) is a rendering of it.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, never reused. `YYYY-MM-DD-short-name` |
| `title` | string | Plain, factual. No hype verbs ("stuns", "shatters") |
| `claim` | string | One sentence a smart non-expert can read |
| `field` | string | `mathematics` \| `computer-science` \| `biology` \| `chemistry` \| `physics` \| `materials` \| `medicine` \| `neuroscience` \| `astronomy` \| `engineering` \| `climate` \| `economics`. A new value needs a display name in the `fields` map in `data/vocab.json` |
| `date` | string | ISO date the result became public |
| `lab` | string | Organization credited. `Independent` if none |
| `model` | string | Model + version. `Unknown` if not disclosed |
| `verification` | enum | See below |
| `autonomy` | enum | See below |
| `sources` | array | `{label, url}`. At least one primary source. `url` must be `http(s)` |
| `added` | string | ISO date this entry was added to the registry |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `humans` | array | Named human collaborators |
| `year_posed` | number | Year the problem/conjecture was first posed. Lets the site show how long it stood before the result. Omit when there is no single origin year (open-ended empirical work) |
| `wikipedia` | string | Title (or URL) of the English Wikipedia article for the *problem itself*, not a person, tool, or broad parent field. Drives `notability`. Choose the most specific article that is genuinely about this problem; omit if none exists |
| `notability` | number | How widely known the problem is: the count of Wikipedia language editions with an article, **English included**. Do not hand-set this: it is computed from `wikipedia` by `build-notability.py`, which follows redirects and records provenance in `notability_meta`. Absent means unrated; there is no `0` (an absent article means no `wikipedia` field, hence no `notability`) |
| `notability_meta` | object | `{source, article, editions, as_of}` written by `build-notability.py`. The audit trail for `notability`: which article was measured, how many editions, and on what date. Never hand-edit |
| `detail` | string | 2–5 sentences of context. What was actually new |
| `novelty_check` | string | What was searched, what turned up. **Write this even when clean** |
| `caveats` | string | Known objections, disputes, unreplicated parts |
| `independent_checks` | array | `{who, url, outcome}` |
| `discussion` | array | `{label, url}`. Threads where the result was debated (Hacker News, Stack Exchange, Reddit). Not a substitute for a primary source |
| `videos` | array | `{label, channel, youtube_id}`. Credible explainers only (official lab channels, established science press, recognized educators). Verify the ID resolves and the channel is who it claims before adding; never add hype-channel content |
| `tags` | array | Free-form: `combinatorics`, `protein-design`, `algorithms` |

## `verification`: how solid is it?

Ordered strongest to weakest. Be conservative; downgrade when unsure.

- **`formal`**: Machine-checked proof (Lean, Coq, Isabelle) or exact symbolic/computational
  verification that anyone can rerun. The gold standard.
- **`independent`**: Multiple qualified humans unaffiliated with the announcing lab have
  checked and confirmed it.
- **`peer-reviewed`**: Published in a venue with real review. Note that this is *weaker* than
  `formal` for math but stronger for empirical claims.
- **`author-verified`**: The human collaborator checked it, no independent confirmation yet.
- **`claimed`**: Announced, not yet checked by anyone outside the lab. Default for press releases.
- **`disputed`**: Substantive technical objections raised and unresolved.
- **`known`**: The result turned out to already exist in the literature. Shown on the site as
  "Already known". **Keep these entries.** They are the most useful thing on the site and the main
  reason to trust it.
- **`refuted`**: Shown to be wrong.

## `autonomy`: how much did the AI actually do?

This column is the whole point. Most breathless claims collapse here.

- **`autonomous`**: AI produced the core idea and the proof/result with no human mathematical
  input beyond posing the problem.
- **`ai-led`**: AI produced the key insight; humans formalized, checked, or cleaned up.
- **`collaborative`**: Genuine back-and-forth. Neither party would have gotten there alone.
- **`ai-assisted`**: Human drove the research; AI accelerated search, algebra, or literature review.
- **`search-scaffold`**: AI is a component inside a human-designed search loop
  (FunSearch, AlphaEvolve). The system found it; the framing was human.
- **`retrieval`**: AI surfaced an existing result humans had overlooked. Valuable, but not new
  mathematics.

## Editorial rules

1. **A novelty check is mandatory before publishing.** Record what you searched even when it
   comes back clean. This field is what separates the registry from a press-release aggregator.
2. **Never delete an entry.** Downgrade its `verification` and add `caveats`. The public git
   history is the credibility mechanism; quiet edits destroy it.
3. **A claim with no reproducible artifact caps at `claimed`.** No exceptions for famous labs.
4. **Lab-announced results start at `claimed`** regardless of how confident the blog post sounds.
5. **`autonomy` is graded on the strictest defensible reading.** When a human posed the problem,
   suggested the approach, and checked the algebra, that is not `autonomous`.
6. **`notability` is measured, not guessed.** Set only `wikipedia` (the article title), then run
   `python3 scripts/build-notability.py` to fill `notability` and `notability_meta` from the live Wikipedia
   API. The one judgment you make is *which article*: pick the one about the problem itself, not a
   person, a tool, or a broad parent field (e.g. a specific sorting result should not point at the
   general "Sorting algorithm" article). No article → no `wikipedia` field → the entry stays unrated.

## Adding an entry

```json
{
  "id": "2026-07-19-jacobian-conjecture",
  "title": "Counterexample to the Jacobian conjecture in dimension 3",
  "claim": "An explicit polynomial map with constant Jacobian determinant -2 that is not invertible, disproving an 87-year-old conjecture.",
  "field": "mathematics",
  "date": "2026-07-19",
  "lab": "Anthropic",
  "model": "Claude Fable 5",
  "humans": ["Levent Alpöge"],
  "year_posed": 1939,
  "wikipedia": "Jacobian conjecture",
  "verification": "formal",
  "autonomy": "collaborative",
  "sources": [{"label": "Explainer", "url": "https://jacobianfun.org/jacobian-explained"}],
  "added": "2026-07-20"
}
```

Add the object to `data/entries.json`, then run `python3 scripts/build.py`. The site is
pre-rendered, so an entry that isn't built isn't on the site. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## What the build enforces

`scripts/build-site.py` validates before writing anything and stops on the first pass with a
message naming the entry and the problem. It is the only place a typo gets caught, so it is
deliberately strict:

- `id`, `title`, `claim`, `date`, `field`, `lab`, `model`, `verification`, `autonomy` must all be
  present and non-empty.
- `verification` and `autonomy` must be one of the values above; `field` must appear in `data/vocab.json`'s `fields` map.
- `date` must be `YYYY-MM-DD`.
- `id` must be unique and URL-safe (lowercase letters, digits, `-`, `_`, `.`). It becomes both a
  filename and a URL path segment.
- Every `url` in `sources`, `discussion` and `independent_checks` must start with `http://` or
  `https://`. `javascript:` and `data:` are rejected: these become `href`s on the page, and the
  site's CSP allows `'unsafe-inline'`, so they would be live links. An `independent_checks` entry
  may omit `url` entirely (an in-house recomputation or a blind assessment has none).
- `youtube_id` must be a valid 11-character YouTube id: it is interpolated into an iframe `src`.

Entry *text* (`title`, `claim`, `detail`, `novelty_check`, `caveats`) is escaped at render time, so
markup in it is displayed rather than executed. It is still flagged for review by
`check-integrity.py`, since it usually means a bad copy-paste.
