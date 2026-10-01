"""Math notation in entry text: \\(inline\\) and \\[display\\] TeX, typeset as MathML.

Entries write formulas as TeX between \\( \\) or \\[ \\]. Not $...$: the registry already
uses $ as a currency sign ("$10,000 prize"), and a formula delimiter that collides with
prose would turn a price into italics. scripts/build-math.mjs renders every formula once,
with the vendored Temml, into data/math.json; this module reads that file and never runs
Node itself, so a build that adds no new formula needs only Python.

Three consumers, three forms of the same formula:

    prose()  HTML for the page: escaped text with the MathML spliced in. A port of
             prose() in app.js, and diffed byte for byte with it through card().
    plain()  readable Unicode for surfaces that cannot carry markup: meta descriptions,
             JSON-LD, feeds. Derived from the MathML rather than from the TeX, so it
             reads the way the formula renders ("d^{-1/2}" becomes "d^(-1/2)" with a real
             minus sign) instead of being stripped, which loses the formula entirely.
    the raw string  for llms.txt and the API, whose readers parse TeX natively.
"""
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATH_PATH = os.path.join(ROOT, "data", "math.json")

# Must match TEX in app.js and in build-math.mjs. Non-greedy, so the first closing
# delimiter ends the formula; validate() rejects anything that would nest.
TEX = re.compile(r"\\\((.+?)\\\)|\\\[(.+?)\\\]", re.S)
DELIMS = ("\\(", "\\)", "\\[", "\\]")

# Prose fields that may carry formulas. Display math is for the long-form field only:
# a block formula inside a one-sentence claim or a folded caveat breaks the paragraph.
MATH_FIELDS = ("claim", "detail", "novelty_check", "caveats")
DISPLAY_FIELDS = ("detail",)

_cache = None


def load():
    """data/math.json as {"inline": {tex: mathml}, "display": {tex: mathml}}."""
    global _cache
    if _cache is None:
        try:
            with open(MATH_PATH, encoding="utf-8") as f:
                _cache = json.load(f)
        except FileNotFoundError:
            _cache = {}
        _cache.setdefault("inline", {})
        _cache.setdefault("display", {})
    return _cache


def _lookup(m):
    if m.group(1) is not None:
        return load()["inline"].get(m.group(1))
    return load()["display"].get(m.group(2))


def prose(s, esc):
    """Entry text as HTML: esc() on the words, MathML for the formulas.

    A formula missing from data/math.json falls back to its escaped source, exactly as
    app.js does when the file fails to load. validate() makes that unreachable here.
    """
    s = "" if s is None else str(s)
    out, pos = [], 0
    for m in TEX.finditer(s):
        out.append(esc(s[pos:m.start()]))
        out.append(_lookup(m) or esc(m.group(0)))
        pos = m.end()
    out.append(esc(s[pos:]))
    return "".join(out)


def plain(s):
    """Entry text with each formula replaced by a readable Unicode rendering."""
    if not s:
        return s
    return TEX.sub(lambda m: _text(_lookup(m)) if _lookup(m) else (m.group(1) or m.group(2)),
                   str(s))


def formulas(e):
    """Every (field, kind, tex) in an entry, kind being "inline" or "display"."""
    found = []
    texts = [(f, e.get(f)) for f in MATH_FIELDS]
    texts += [(f"independent_checks[{i}].outcome", c.get("outcome"))
              for i, c in enumerate(e.get("independent_checks") or []) if isinstance(c, dict)]
    for field, v in texts:
        if isinstance(v, str):
            for m in TEX.finditer(v):
                found.append((field, "inline" if m.group(1) is not None else "display",
                              m.group(1) if m.group(1) is not None else m.group(2)))
    return found


def problems(e, where):
    """Delimiter mistakes, formulas in the wrong field, and formulas not yet rendered."""
    out = []
    texts = [(f, e.get(f)) for f in MATH_FIELDS]
    texts += [(f"independent_checks[{i}].outcome", c.get("outcome"))
              for i, c in enumerate(e.get("independent_checks") or []) if isinstance(c, dict)]
    for field, v in texts:
        if not isinstance(v, str):
            continue
        for m in TEX.finditer(v):
            inner = m.group(1) if m.group(1) is not None else m.group(2)
            if any(d in inner for d in DELIMS):
                out.append(f"{where}: {field} has a formula nested inside another: "
                           f"{m.group(0)[:60]!r}")
            # Temml, like TeX, reads 1,5 as a single number with a decimal comma, so
            # (0,0,1) typesets as the two numbers "0,0" and "1". Ask for the intent.
            if re.search(r"\d,\d", inner):
                out.append(f"{where}: {field}: {m.group(0)[:60]!r} has a comma between "
                           "digits, which typesets as one number. Write 1, 2 for a list "
                           "or 1{,}076 for a thousands separator")
            if m.group(2) is not None and field not in DISPLAY_FIELDS:
                out.append(f"{where}: {field} uses display math \\[...\\]; that is for "
                           f"'detail' only. Write it inline as \\(...\\)")
        rest = TEX.sub("", v)
        for d in DELIMS:
            if d in rest:
                i = rest.index(d)
                out.append(f"{where}: {field} has an unmatched {d} near "
                           f"{rest[max(0, i - 25):i + 25]!r}")
                break
    # Text that becomes a page title, an aria-label, a chart label or a link name has no
    # way to carry markup. Those stay plain Unicode: 4×4, SOP₂, 2ⁿ.
    plain_texts = [("title", e.get("title"))]
    for key in ("sources", "discussion", "videos"):
        plain_texts += [(f"{key}[{i}].label", s.get("label"))
                        for i, s in enumerate(e.get(key) or []) if isinstance(s, dict)]
    plain_texts += [(f"independent_checks[{i}].who", c.get("who"))
                    for i, c in enumerate(e.get("independent_checks") or [])
                    if isinstance(c, dict)]
    for field, v in plain_texts:
        if isinstance(v, str) and any(d in v for d in DELIMS):
            out.append(f"{where}: {field} contains TeX; it renders as plain text, so "
                       "write the notation in Unicode instead (2ⁿ, x², SOP₂)")
    cache = load()
    for field, kind, tex in formulas(e):
        if tex not in cache[kind]:
            out.append(f"{where}: {field}: formula {tex!r} is not in data/math.json. "
                       "Run python3 scripts/build.py with Node installed to typeset it")
    return out


# ------------------------------------------------------------------ MathML to text
SUP = dict(zip("0123456789+-=()niabcdefghjklmoprstuvwxyz−",
               "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻"
               "⁼⁽⁾ⁿⁱᵃᵇᶜᵈᵉᶠᵍ"
               "ʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛ"
               "ʷˣʸᶻ⁻"))
SUB = dict(zip("0123456789+-=()aehijklmnoprstuvx−",
               "₀₁₂₃₄₅₆₇₈₉₊₋"
               "₌₍₎ₐₑₕᵢⱼₖₗₘₙ"
               "ₒₚᵣₛₜᵤᵥₓ₋"))
# Operators that read better with a space either side in running text.
SPACED = set("=<>≤≥≠≈≡→←↔↦⇒⇔∈"
             "∉⊂⊃⊆⊇∼≃≍≪≫∝⊢⊨"
             "+−±×⋅⊕⊗∪∩∧∨∘")
assert len(SUP) == 41 and len(SUB) == 33, "script tables are misaligned"
# Function application, invisible times and friends, plus the text-presentation selector
# Temml puts after symbols like ⊕ so they never render as emoji. Escaped: invisible.
INVISIBLE = {"\u2061", "\u2062", "\u2063", "\u2064", "\ufe0e", "\ufe0f"}
# Accents above a letter, as the combining character that sits on the letter in text.
ACCENT = {"~": "\u0303", "˜": "\u0303", "^": "\u0302", "ˆ": "\u0302",
          "¯": "\u0304", "‾": "\u0304", "˙": "\u0307", "¨": "\u0308",
          "→": "\u20d7", "\u20d7": "\u20d7"}


def _norm(t):
    """Math-alphabet letters back to ordinary ones, except double-struck (ℝ, 𝔼), which
    carry meaning. 𝖰𝖬𝖠 in a search snippet is unreadable and unsearchable; QMA is not."""
    out = []
    for ch in t:
        if ch in INVISIBLE:
            continue
        if 0x1D400 <= ord(ch) <= 0x1D7FF and "DOUBLE-STRUCK" not in unicodedata.name(ch, ""):
            ch = unicodedata.normalize("NFKC", ch)
        elif ch == "∗":         # asterisk operator, as in O^*
            ch = "*"
        elif ch == "\u00a0":       # the space "\ " makes in TeX
            ch = " "
        out.append(ch)
    return "".join(out)


def _script(s, table, mark):
    """A super- or subscript: Unicode script characters when every one exists,
    otherwise ^x or ^(...)."""
    s = s.strip()
    if s and all(c in "\u2032\u2033\u2034" for c in s):     # primes: f\u2032, not f^(\u2032)
        return s
    if s and all(c in table for c in s):
        return "".join(table[c] for c in s)
    return mark + (s if re.fullmatch(r"[\w.*]+", s) else f"({s})")


def _group(s):
    s = s.strip()
    return s if len(s) == 1 or re.fullmatch(r"√?[\w.]+", s) else f"({s})"


def _walk(el):
    tag = el.tag
    kids = list(el)
    if tag == "annotation":
        return ""
    if tag in ("mi", "mn", "mtext", "ms"):
        return _norm(el.text or "")
    if tag == "mo":
        t = _norm(el.text or "")
        # A prefix minus is a sign, not subtraction: d^(−1/2), not d^( − 1/2).
        if t in SPACED and el.get("form") != "prefix":
            return f" {t} "
        if t == ",":
            return ", "
        return t
    if tag == "mspace":
        w = el.get("width", "")
        m = re.match(r"([\d.]+)em", w)
        return " " if m and float(m.group(1)) >= 0.16 else ""
    if tag == "msup" and len(kids) == 2:
        return _walk(kids[0]) + _script(_walk(kids[1]), SUP, "^")
    if tag == "msub" and len(kids) == 2:
        return _walk(kids[0]) + _script(_walk(kids[1]), SUB, "_")
    if tag == "msubsup" and len(kids) == 3:
        return (_walk(kids[0]) + _script(_walk(kids[1]), SUB, "_")
                + _script(_walk(kids[2]), SUP, "^"))
    if tag == "munder" and len(kids) == 2:
        return _walk(kids[0]) + _script(_walk(kids[1]), SUB, "_")
    if tag == "mover" and len(kids) == 2:
        base, acc = _walk(kids[0]), _walk(kids[1]).strip()
        return base + ACCENT[acc] if acc in ACCENT and len(base) == 1 else base
    if tag == "munderover" and len(kids) == 3:
        return (_walk(kids[0]) + _script(_walk(kids[1]), SUB, "_")
                + _script(_walk(kids[2]), SUP, "^"))
    if tag == "mfrac" and len(kids) == 2:
        return _group(_walk(kids[0])) + "/" + _group(_walk(kids[1]))
    if tag == "msqrt":
        return "√" + _group("".join(_walk(k) for k in kids))
    if tag == "mroot" and len(kids) == 2:
        return _script(_walk(kids[1]), SUP, "^") + "√" + _group(_walk(kids[0]))
    if tag == "mtr":
        return "  ".join(_walk(k).strip() for k in kids)
    if tag == "mtable":
        return "; ".join(_walk(k).strip() for k in kids)
    return "".join(_walk(k) for k in kids)


def _text(mathml):
    try:
        root = ET.fromstring(mathml)
    except ET.ParseError:
        return mathml
    t = re.sub(r" {2,}", " ", _walk(root)).strip()
    # Temml spaces an operator name like log off whatever precedes it; after a slash
    # that reads as a gap in the fraction: d²/log d, not d²/ log d.
    t = t.replace("/ ", "/")
    # A spaced operator directly after an opening bracket, or before a closing one or a
    # comma, is a sign or an empty slot, not a binary operator: (-1) not ( - 1).
    t = re.sub(r"([(\[{,]) ([+−±]) ", r"\1\2", t)
    t = re.sub(r"^([+−±]) ", r"\1", t)
    return t
