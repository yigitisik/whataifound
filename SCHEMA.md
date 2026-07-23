# Entry Schema

Every finding is one JSON object in `data/entries.json`. The schema is the product. Everything
else (site, search, company pages) is a rendering of it.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, never reused. `YYYY-MM-DD-short-name` |
| `title` | string | Plain, factual. No hype verbs ("stuns", "shatters") |
| `claim` | string | One sentence a smart non-expert can read |
| `field` | string | `mathematics` \| `computer-science` \| `biology` \| `chemistry` \| `physics` \| `materials` |
| `date` | string | ISO date the result became public |
| `lab` | string | Organization credited. `Independent` if none |
| `model` | string | Model + version. `Unknown` if not disclosed |
| `verification` | enum | See below |
| `autonomy` | enum | See below |
| `sources` | array | `{label, url}`. At least one primary source |
| `added` | string | ISO date this entry was added to the registry |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `humans` | array | Named human collaborators |
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
  "verification": "formal",
  "autonomy": "collaborative",
  "sources": [{"label": "Explainer", "url": "https://jacobianfun.org/jacobian-explained"}],
  "added": "2026-07-20"
}
```
