// Handle generation and validation.
//
// A new account is never unnamed and never named after the person. Google returns a
// real name; using it as the default handle would publish an identity the reader never
// chose to share, on an account that may only ever cast one signal.
//
// The wordlist is in the site's own register rather than the usual consumer
// adjective-noun-1234. A page set in Newsreader that credits people for checking proofs
// should not hand them `swift-otter-4417`. Digits appear only when a collision forces
// them, so a generated handle reads as a name rather than as a placeholder.

// Quiet, physical, unhurried. No adjectives that imply status or quality: a handle is
// not a compliment, and `brilliant-lemma` would read as one.
const ADJECTIVES = [
  "amber", "auburn", "brisk", "candid", "civil", "clement", "cobalt", "dusk",
  "even", "flint", "gentle", "granite", "hazel", "indigo", "inland", "keen",
  "lucid", "marble", "mild", "narrow", "northern", "olive", "opal", "patient",
  "plain", "quiet", "russet", "sable", "sage", "slate", "sober", "solemn",
  "steady", "still", "sudden", "temperate", "tidal", "umber", "upland", "vellum",
  "verdant", "vernal", "walnut", "western", "willow", "winter", "wry",
];

// Mathematical and scientific nouns, all of them things rather than people: naming an
// account after a living mathematician would attach a real reputation to a stranger.
const NOUNS = [
  "axiom", "basis", "bound", "bracket", "cipher", "cluster", "cochain", "conjecture",
  "corollary", "cusp", "cycle", "degree", "delta", "domain", "eigen", "fibre",
  "filter", "functor", "gamma", "genus", "gradient", "graph", "group", "helix",
  "ideal", "integral", "kernel", "knot", "lambda", "lattice", "lemma", "limit",
  "manifold", "matrix", "measure", "modulus", "norm", "orbit", "parity", "period",
  "prime", "proof", "quotient", "radius", "residue", "ring", "scalar", "sequence",
  "series", "sheaf", "simplex", "spectrum", "spline", "surface", "tensor", "theorem",
  "topos", "torus", "vector", "vertex", "zeta",
];

// Anything that could be mistaken for the site speaking, for a role, or for a route.
// Checked case-insensitively, and the database's lower(handle) unique index makes the
// same comparison, so `Admin` cannot slip past a lowercase list.
const RESERVED = new Set([
  "about", "account", "admin", "administrator", "api", "assets", "auth", "contribute",
  "contributors", "data", "editor", "entries", "entry", "faq", "feed", "finding",
  "findings", "help", "index", "llms", "login", "logout", "maintainer", "maintainers",
  "me", "methodology", "mod", "moderator", "new", "null", "official", "owner", "privacy",
  "profile", "registry", "review", "reviewer", "reviewers", "robots", "root", "rss",
  "search", "settings", "signin", "signout", "signup", "site", "sitemap", "staff",
  "support", "system", "team", "terms", "u", "undefined", "user", "users", "visuals",
  "whataifound", "www",
]);

export const HANDLE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
// One rename per 30 days. A handle is how other people refer to a contributor, so it
// should not be a moving target, and the cooldown also blunts handle-squatting churn.
export const RENAME_COOLDOWN_DAYS = 30;

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/**
 * A candidate handle. `rand` is injectable so the tests are deterministic.
 * `attempt` is the collision round: the first is bare, later ones get a suffix.
 */
export function generateHandle(rand = Math.random, attempt = 0) {
  const base = `${pick(ADJECTIVES, rand)}-${pick(NOUNS, rand)}`;
  if (attempt === 0) return base;
  // -2, -3, ... for the first few, then a random tail once the space is genuinely
  // contended, so we never walk a long sequential probe.
  if (attempt < 8) return `${base}-${attempt + 1}`;
  return `${base}-${Math.floor(rand() * 9000 + 1000)}`;
}

/** How many distinct bare handles exist. Used by the tests to assert head-room. */
export const HANDLE_SPACE = ADJECTIVES.length * NOUNS.length;

/**
 * Validate a handle a person typed. Returns null when fine, else a reason to show.
 * The message is the UI copy: it is written to be read by the person who typed it.
 */
export function validateHandle(raw) {
  const h = String(raw || "").trim().toLowerCase();
  if (!h) return "Pick a handle.";
  if (h.length < HANDLE_MIN) return `Handles are at least ${HANDLE_MIN} characters.`;
  if (h.length > HANDLE_MAX) return `Handles are at most ${HANDLE_MAX} characters.`;
  if (!HANDLE_RE.test(h)) {
    return "Use lowercase letters, digits and single hyphens, with no hyphen at either end.";
  }
  if (RESERVED.has(h)) return "That handle is reserved.";
  // A handle that is only digits reads as an id and collides with future numeric routes.
  if (/^[0-9]+$/.test(h)) return "Handles need at least one letter.";
  return null;
}

/** Normalise for storage and comparison. */
export function normaliseHandle(raw) {
  return String(raw || "").trim().toLowerCase();
}

export const RESERVED_HANDLES = RESERVED;
