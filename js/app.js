// Grade labels. Generated from data/vocab.json by scripts/build-site.py: edit the
// vocabulary there, not here. app.js is served to the browser as-is and cannot read
// JSON at load, so the tables are written into the file at build time instead.
/*VOCAB:START*/
const VER_LABEL = {
  "formal":"Formally verified",
  "independent":"Independently checked",
  "peer-reviewed":"Peer reviewed",
  "author-verified":"Author verified",
  "claimed":"Claimed",
  "disputed":"Disputed",
  "known":"Already known",
  "refuted":"Refuted"
};
const AUT_LABEL = {
  "autonomous":"Autonomous",
  "ai-led":"AI-led",
  "collaborative":"Collaborative",
  "ai-assisted":"AI-assisted",
  "search-scaffold":"Search scaffold",
  "retrieval":"Retrieval"
};
const VER_SCORE = {
  "formal":4,
  "independent":3,
  "peer-reviewed":3,
  "author-verified":2,
  "claimed":1,
  "known":-1,
  "disputed":-2,
  "refuted":-3
};
const AUT_RANK = {
  "autonomous":5,
  "ai-led":4,
  "collaborative":3,
  "ai-assisted":2,
  "search-scaffold":1,
  "retrieval":0
};
const SRC_LABEL = {
  "research":"Original work",
  "announcement":"Announcement",
  "coverage":"Media coverage",
  "commentary":"Independent commentary",
  "challenge":"Challenge"
};
const SRC_CHIP = {
  "research":"Original work",
  "announcement":"Announced",
  "coverage":"Media",
  "commentary":"Commentary",
  "challenge":"Challenge"
};
const SRC_ORDER = ["research", "announcement", "coverage", "commentary", "challenge"];
const REG_NAME = {
  "palomar":"Palomar",
  "proofatlas":"ProofAtlas",
  "mathdb":"MathDB",
  "vibemathed":"vibemathed"
};
const REG_ORDER = ["palomar", "proofatlas", "mathdb", "vibemathed"];
/*VOCAB:END*/
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
let ALL = [], first = true;

// The theme switcher used to live here. It moved to chrome.js, which loads on every
// page: this file does not, so the switcher was missing from five of the seven page
// types. REDUCE stays because the chart and card animations below still read it.

function esc(s){ return String(s??'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Official symbol marks (Wikimedia Commons, cropped; see assets/external-logos/README.md).
// Trademarks of their owners, shown for identification only.
const LAB_LOGO = {
  'Anthropic':'assets/external-logos/anthropic.svg',
  'OpenAI':'assets/external-logos/openai.svg', 'OpenAI / Harmonic':'assets/external-logos/openai.svg',
  'Google DeepMind':'assets/external-logos/deepmind.svg', 'Google':'assets/external-logos/google.svg'
};
// Monogram fallback for labs without a sourced logo.
const LAB_MARK = {
  'FutureHouse':{t:'F',c:'#7a5cd0'},
  'Lawrence Berkeley National Laboratory':{t:'LB',c:'#1d4e89'},
  'Independent':{t:'IN',c:'#7c7a72'}
};
function labMark(lab){
  const src = LAB_LOGO[lab];
  // 19x19: the chip is a fixed 27px box with 4px of padding on each side (styles.css).
  // CSS already reserves the space, so this is for the crawlers and auditors that read
  // the attributes rather than the stylesheet. Mirrored in build-site.py's lab_mark().
  if (src) return `<span class="labchip img" aria-hidden="true"><img src="${esc(src)}" alt="" width="19" height="19" loading="lazy" decoding="async"></span>`;
  const m = LAB_MARK[lab] || {t:(lab||'?').trim().slice(0,1).toUpperCase(), c:'#7c7a72'};
  return `<span class="labchip" style="--lc:${m.c}" aria-hidden="true">${esc(m.t)}</span>`;
}
const DOMAIN_NAME = {
  'nature.com':'Nature','arxiv.org':'arXiv','news.ycombinator.com':'Hacker News',
  'en.wikipedia.org':'Wikipedia','quantamagazine.org':'Quanta','theregister.com':'The Register',
  'deepmind.google':'DeepMind','spectrum.ieee.org':'IEEE Spectrum','github.com':'GitHub',
  'ncbi.nlm.nih.gov':'NIH PMC','techcrunch.com':'TechCrunch','the-decoder.com':'The Decoder',
  'unite.ai':'Unite.AI','hackmd.io':'HackMD','allthings.how':'AllThings.how',
  'turingpost.com':'Turing Post','techjacksolutions.com':'Tech Jacks',
  'nobelprize.org':'Nobel Prize','actu.epfl.ch':'EPFL','storage.googleapis.com':'DeepMind',
  // The card face shows this name instead of the link title, so an unmapped host renders
  // as a raw domain there. Keep in step with DOMAIN_NAME in build-site.py.
  'science.org':'Science','biorxiv.org':'bioRxiv','cell.com':'Cell',
  'pmc.ncbi.nlm.nih.gov':'NIH PMC','iopscience.iop.org':'IOP',
  'pubs.rsc.org':'Materials Horizons','blog.google':'Google','microsoft.com':'Microsoft',
  'nasa.gov':'NASA','nih.gov':'NIH','news.mit.edu':'MIT News','ox.ac.uk':'Oxford',
  'engineering.princeton.edu':'Princeton','sakana.ai':'Sakana AI',
  'arcinstitute.org':'Arc Institute','bakerlab.org':'Baker Lab',
  'evolutionaryscale.ai':'EvolutionaryScale','insilico.com':'Insilico','math.inc':'Math Inc.',
  'flywire.ai':'FlyWire','scrollprize.org':'Vesuvius Challenge','asimov.press':'Asimov Press',
  'physicsworld.com':'Physics World','sciencedaily.com':'ScienceDaily',
  'officechai.com':'OfficeChai','x.com':'X','scottaaronson.blog':'Scott Aaronson',
  'terrytao.wordpress.com':'Terence Tao','xenaproject.wordpress.com':'Kevin Buzzard',
  'simonwillison.net':'Simon Willison','alexisgallagher.com':'Alexis Gallagher',
  'jacobianfun.org':'jacobianfun.org','openai.com':'OpenAI',
  'journalofinfection.com':'Journal of Infection','cam.ac.uk':'Cambridge',
  'cdn.openai.com':'OpenAI','proofatlas.ai':'ProofAtlas',
  'scientificamerican.com':'Scientific American','zenodo.org':'Zenodo',
  'openproblemgarden.org':'Open Problem Garden','doi.org':'DOI',
  'vibemathed.com':'VibeMathed','www-cdn.anthropic.com':'Anthropic',
  'chatgpt.com':'ChatGPT','primegaps.axiommath.ai':'Axiom Math',
  'news.mcmaster.ca':'McMaster University','alpo.ge':'Levent Alpöge',
  'researchgate.net':'ResearchGate'
};
function domainOf(url){
  try{ const h = new URL(url).hostname.replace(/^www\./,''); return DOMAIN_NAME[h] || h; }
  catch(_){ return ''; }
}
function refRow(s){
  const dom = domainOf(s.url);
  let label = s.label || '';
  const i = label.indexOf(': ');
  if (i > 0 && label.slice(0,i).trim().toLowerCase() === dom.toLowerCase()) label = label.slice(i+2);
  return `<a class="ref" href="${esc(s.url)}" target="_blank" rel="noopener">`+
    `<span class="ref-dom">${esc(dom)}</span><span class="ref-t">${esc(label)}</span><span class="ref-a">↗</span></a>`;
}

// The card face: what each link is, without opening the disclosure. This is the whole
// point of classifying sources - the distance between a result and a headline lives in
// the gap between these rows, and a reader who has to click to see it will not.
const RECEIPT_MAX = 3;
function receipts(e){
  const src = e.sources || [];
  const rows = SRC_ORDER.map(kind => {
    const of = src.filter(s => s.kind === kind);
    // A missing challenge is the one absence worth stating: most of the registry has
    // none, and rendering nothing would quietly read as "nothing to answer here".
    if (!of.length) return kind === 'challenge'
      ? `<div class="rc-row"><dt class="rc-k k-${esc(kind)}">${esc(SRC_CHIP[kind])}</dt>`+
        `<dd class="rc-v rc-none">none linked</dd></div>` : '';
    // Visible text is the domain, which is short enough to fit several per row but
    // says nothing on its own - and two papers from the same host would otherwise
    // render as two identical words. The full title carries the meaning, so it
    // becomes the accessible name and the hover text.
    const shown = of.slice(0, RECEIPT_MAX).map(s =>
      `<a class="rc-l" href="${esc(s.url)}" target="_blank" rel="noopener" `+
      `title="${esc(s.label)}" aria-label="${esc(s.label)}">${esc(domainOf(s.url))}`+
      `<span class="rc-a" aria-hidden="true">↗</span></a>`).join('');
    const extra = of.length > RECEIPT_MAX
      ? `<span class="rc-more">+${of.length - RECEIPT_MAX}</span>` : '';
    return `<div class="rc-row"><dt class="rc-k k-${esc(kind)}">${esc(SRC_CHIP[kind])}</dt>`+
           `<dd class="rc-v">${shown}${extra}</dd></div>`;
  }).join('');
  return rows ? `<dl class="receipts">${rows}</dl>` : '';
}

// The same links inside the disclosure, grouped and with their full titles.
function groupedRefs(src){
  return SRC_ORDER.map(kind => {
    const of = (src || []).filter(s => s.kind === kind);
    if (!of.length) return '';
    return `<div class="field reveal kind k-${esc(kind)}"><b>${esc(SRC_LABEL[kind])}</b>`+
           `<div class="refs">${of.map(refRow).join('')}</div></div>`;
  }).join('');
}

// Derived, never stored: how long the problem stood before this result.
// Resolution year comes from the entry's own date.
function yearsOpen(e){
  if (e.year_posed == null) return null;
  const resolved = +String(e.date).slice(0,4);
  const n = resolved - e.year_posed;
  return n >= 0 ? n : null;
}
function openMeta(e){
  const n = yearsOpen(e);
  if (n == null) return '';
  const span = n === 0 ? 'same year' : `open ${n} yr${n===1?'':'s'}`;
  return `<div><dt>Posed</dt><dd>${e.year_posed} · ${span}</dd></div>`;
}

function card(e){
  const f = (label, val) => val ? `<div class="field reveal"><b>${label}</b><p>${esc(val)}</p></div>` : '';
  const checks = (e.independent_checks||[]).map(c =>
    `<p>${esc(c.who)}: <em>${esc(c.outcome)}</em>${c.url?` · <a href="${esc(c.url)}" target="_blank" rel="noopener">link ↗</a>`:''}</p>`).join('');
  const refs = arr => `<div class="refs">${(arr||[]).map(refRow).join('')}</div>`;
  return `<article class="entry" id="e-${esc(e.id)}" data-ver="${esc(e.verification)}">
    <div class="rail">
      <div class="lab">${labMark(e.lab)}<span class="lab-name">${esc(e.lab)}</span></div>
      <div class="rdate">${esc(e.date)}</div>
      <div class="rpills">
        <span class="pill v v-${esc(e.verification)}">${esc(VER_LABEL[e.verification]||e.verification)}</span>
        <span class="pill a a-${esc(e.autonomy)}">${esc(AUT_LABEL[e.autonomy]||e.autonomy)}</span>
      </div>
      <dl class="rmeta">
        <div><dt>Model</dt><dd>${esc(e.model)}</dd></div>
        <div><dt>Field</dt><dd>${esc(e.field)}</dd></div>
        ${openMeta(e)}
      </dl>
    </div>
    <div class="body">
      <h2><a class="entry-link" href="/finding/${esc(e.id)}">${esc(e.title)}</a><a class="permalink" href="#e-${esc(e.id)}" data-permalink="e-${esc(e.id)}" aria-label="Copy link to this entry" title="Copy link to this entry">#</a></h2>
      <p class="claim">${esc(e.claim)}</p>
      ${e.detail ? `<p class="detail">${esc(e.detail)}</p>` : ''}
      ${e.humans?.length ? `<p class="withppl"><span>With</span><b>${esc(e.humans.join(', '))}</b></p>` : ''}
      ${e.tags?.length ? `<div class="tags">${e.tags.map(t=>`<a class="tag-chip" href="/?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
      ${receipts(e)}
      <details>
        <summary>Novelty check, caveats &amp; sources</summary>
        ${f('Novelty check', e.novelty_check)}
        ${f('Caveats', e.caveats)}
        ${checks ? `<div class="field checks reveal"><b>Independent checks</b>${checks}</div>` : ''}
        ${groupedRefs(e.sources)}
        ${e.discussion?.length ? `<div class="field reveal"><b>Community discussion</b>${refs(e.discussion)}</div>` : ''}
        ${e.videos?.length ? `<div class="field reveal"><b>Video explainers</b>
          ${e.videos.map(v=>`<div class="vid" data-yt="${esc(v.youtube_id)}">
            <button class="vid-play" type="button" aria-label="Play video: ${esc(v.label)}">&#9654;</button>
            <span class="vid-meta"><span class="vid-t">${esc(v.label)}</span><span class="vid-ch">${esc(v.channel)}</span></span>
            <a class="vid-ext" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.youtube_id)}" target="_blank" rel="noopener">YouTube ↗</a>
          </div>`).join('')}
          <p class="vid-note">Nothing loads from YouTube until you press play.</p>
        </div>` : ''}
      </details>
    </div>
  </article>`;
}

// Sitemap rail: scroll-spy dot nav. Highlights the section in view.
(function(){
  const nav = document.querySelector('.sitenav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[data-target]')];

  const setActive = id => links.forEach(a =>
    a.classList.toggle('active', a.dataset.target === id));

  const targets = () => links
    .map(a => document.getElementById(a.dataset.target))
    .filter(el => el && !el.hidden && el.offsetParent !== null);

  // Sections range from ~500px (Sources, About) to ~8000px (the registry list), and
  // scrollIntoView can land a short section well below the viewport top (layout not
  // yet settled when it fires), so both "highest intersection ratio" and "whose top
  // crossed a fixed line" misjudge it. Instead: score every section by how much of
  // a fixed near-top detection zone it covers, and take the best-covered one; this
  // is correct regardless of exactly where a section lands. Force the final section
  // active once scrolled to the bottom of the page (its own span may be shorter
  // than the detection zone there).
  // ZONE_TOP starts below the sticky filter bar (~70px): content behind it is
  // covered, not actually visible, so it shouldn't count toward a section's score.
  const ZONE_TOP = 72, ZONE_BOTTOM = 320; // px from viewport top
  let ticking = false;
  const update = () => {
    ticking = false;
    const els = targets();
    if (!els.length) return;
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) { setActive(els[els.length - 1].id); return; }
    let best = els[0], bestOverlap = -1;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const overlap = Math.min(r.bottom, ZONE_BOTTOM) - Math.max(r.top, ZONE_TOP);
      if (overlap > bestOverlap) { bestOverlap = overlap; best = el; }
    }
    setActive(best.id);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  links.forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    const el = document.getElementById(a.dataset.target);
    if (!el) return;
    el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${a.dataset.target}`);
  }));
})();

function renderCharts(){
  const el = document.getElementById('charts');
  if (!el) return;
  const tally = keyFn => { const m={}; ALL.forEach(e=>{const k=keyFn(e); if(k!=null) m[k]=(m[k]||0)+1;}); return m; };
  const am = tally(e => e.autonomy);
  // Most AI-driven first: the reverse of the stacking order above, because a ranked list
  // reads top down where a stack reads bottom up.
  const byAut = AUT_ORDER.slice().reverse().filter(a => am[a])
    .map(a => [AUT_LABEL[a]||a, am[a], AUT_VAR[a]]);

  // Three sections, in the order the lede names them, so the page argues rather than just
  // listing. A grid row is as tall as its tallest card, so each section keeps an even count
  // of half-width cards and lets the hero and the two long list cards take the full width:
  // an odd count orphans the last card beside dead space.
  const section = (id, title, note, cards) =>
    `<section class="qv-sec" aria-labelledby="${id}">`+
    `<h2 class="qv-sec-t" id="${id}">${esc(title)}</h2>`+
    `<p class="qv-sec-n">${esc(note)}</p>`+
    `<div class="qv-grid">${cards}</div></section>`;

  el.innerHTML =
    section('sec-time', 'How findings accumulate',
      'When each result became public, and what kind of AI work produced it.',
      trendCard() + mixCard() + checkedCard()) +
    section('sec-evidence', 'How solid the evidence is',
      'What has been checked, by whom, and where the checking runs out.',
      matrixCard() + fieldGradeCard() + evidenceCard() + coverageCard() +
      // Wide rather than a fifth half-width card: four rows and a two-denominator
      // footnote do not fit a column, and a fifth half card would orphan itself.
      registryCard('qv-wide')) +
    section('sec-autonomy', 'How much the AI did',
      'Which systems and organisations produced these results, and what they were up against.',
      labGradeCard() + spanCard() + modelCard() +
      `<div class="qv-card"><div class="qv-head"><h3 class="qv-title">By autonomy grade</h3></div>`+
      hbarsHtml(byAut, 'By autonomy grade')+
      `<p class="qv-foot">The strictest defensible reading of what the AI did unaided. `+
      `<a href="/methodology">How these are graded</a>.</p></div>` +
      // The record chart reads straight into the record list below it.
      recordCard('qv-wide') +
      // 8 rather than the home page's 4, and full width: these rows carry a title, and a
      // half-width column clamps most of them to two lines.
      standingCard(8, 'qv-wide') +
      // 0 = no cap: this page has the width for all of them, the home page does not.
      topicCard(0, 'qv-wide'));
  renderInsights();
  wireScatterTip();
  wireChartControls();
}

// Headline figures above the charts. The charts show distributions; these state the
// handful of conclusions worth taking away, each one derived rather than written down
// so it cannot drift from the registry.
function renderInsights(){
  const el = document.getElementById('insights');
  if (!el) return;
  const n = ALL.length;
  const count = fn => ALL.filter(fn).length;
  const pct = k => Math.round(k / n * 100);

  const strong = count(e => ['formal','independent','peer-reviewed'].includes(e.verification));
  const negative = count(e => ['known','disputed','refuted'].includes(e.verification));
  const scaffold = count(e => e.autonomy === 'search-scaffold');
  const spans = ALL.map(yearsOpen).filter(v => v != null).sort((a,b)=>a-b);
  const median = spans.length
    ? (spans.length % 2 ? spans[(spans.length-1)/2]
       : Math.round((spans[spans.length/2-1] + spans[spans.length/2]) / 2))
    : null;

  // A number is easier to argue with than to picture, so each tile names one entry behind
  // it. Chosen from sorted data rather than by array position, so an unrelated edit to
  // data/entries.json cannot silently swap the example out from under a tile.
  const newest = fn => ALL.filter(fn)
    .sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
                || (a.id < b.id ? -1 : 1))[0] || null;
  // Nearest the median rather than at the middle index: for an even count the figure shown
  // is the mean of the middle two, and naming an entry whose own span differs from the
  // number printed above it would read as an error.
  const nearest = v => v == null ? null : ALL.filter(e => yearsOpen(e) != null)
    .sort((a,b) => Math.abs(yearsOpen(a)-v) - Math.abs(yearsOpen(b)-v)
                || (a.id < b.id ? -1 : 1))[0] || null;

  const cards = [
    [`${strong}`, `of ${n} well verified`,
     `Formally verified, independently checked or peer reviewed. ${pct(strong)}% of the registry.`,
     newest(e => ['formal','independent','peer-reviewed'].includes(e.verification))],
    [`${scaffold}`, 'came from search scaffolds',
     'An LLM inside a human-built search loop (FunSearch, AlphaEvolve), not a model reasoning on its own.',
     newest(e => e.autonomy === 'search-scaffold')],
    [`${negative}`, 'negative or contested',
     'Already known, disputed or refuted. Kept on the record rather than deleted.',
     newest(e => ['known','disputed','refuted'].includes(e.verification))],
  ];
  if (median != null) cards.push([`${median}yr`, 'median problem age',
    `Half the problems with a known posed year had stood longer than this before the result.`,
    nearest(median)]);

  el.innerHTML = cards.map(([big, label, note, ex]) =>
    `<div class="ins"><b>${esc(big)}</b><span class="ins-l">${esc(label)}</span>`+
    `<span class="ins-n">${esc(note)}</span>`+
    // Internal path built from the entry's own id, so it needs no href validation.
    (ex ? `<a class="ins-x" href="/finding/${encodeURIComponent(ex.id)}">${esc(ex.title)}</a>` : '')+
    `</div>`).join('');
}

// The verification vocabulary as chart furniture: display order, colour variable and the
// short label a 138px label column can hold. Module scope rather than local to
// renderCharts(), because the grade breakdown and the coverage card both read them and a
// second copy is a second thing to keep in step with data/vocab.json.
const GRADE_ORDER = ['formal','independent','peer-reviewed','author-verified','claimed','disputed','known','refuted'];
const GRADE_VAR = {formal:'--formal',independent:'--independent','peer-reviewed':'--peer','author-verified':'--author',
  claimed:'--claimed',disputed:'--disputed',known:'--known',refuted:'--refuted'};
const GRADE_SHORT = {formal:'Formal',independent:'Independent','peer-reviewed':'Peer reviewed',
  'author-verified':'Author',claimed:'Claimed',disputed:'Disputed',known:'Already known',refuted:'Refuted'};

// Autonomy is the axis this registry owns, so it is the colour key of the matrix and of
// the tinted pills on every card, which is what keeps the chart and the cards agreeing.
const AUT_COLOR = {
  'autonomous':'var(--formal)','ai-led':'var(--independent)','collaborative':'var(--peer)',
  'ai-assisted':'var(--author)','search-scaffold':'var(--disputed)','retrieval':'var(--known)'
};

// Chart labels for the `field` slugs. Unlisted fields fall back to the raw value, so a
// new one still renders; it just reads as the slug until it is named here.
const FIELD_SHORT = {
  'mathematics':'Mathematics','computer-science':'Computer science','biology':'Biology',
  'materials':'Materials','physics':'Physics','chemistry':'Chemistry','medicine':'Medicine',
  'neuroscience':'Neuroscience','astronomy':'Astronomy','archaeology':'Archaeology',
  'engineering':'Engineering','climate':'Climate','economics':'Economics'
};
function matrixCard(){
  const pts = ALL.filter(e => VER_SCORE[e.verification] != null && AUT_RANK[e.autonomy] != null);
  const missing = ALL.length - pts.length;
  if (!pts.length){
    return `<div class="qv-card"><h3 class="qv-title">Evidence vs. autonomy</h3>`+
      `<p class="qv-empty">No entries carry both a verification grade and an autonomy grade yet.</p></div>`;
  }

  // Group by cell, keeping the entries so the tooltip can name them.
  const cells = new Map();
  pts.forEach(e => {
    const ax = AUT_RANK[e.autonomy], vy = VER_SCORE[e.verification];
    const k = ax + ':' + vy;
    if (!cells.has(k)) cells.set(k, {ax, vy, list: []});
    cells.get(k).list.push(e);
  });

  // Axis domains come from the vocabulary, not the data, so an empty column or row still
  // shows: "nothing is autonomous and refuted" is a finding, and a chart that silently
  // dropped that column would hide it.
  const axRanks = [...new Set(Object.values(AUT_RANK))].sort((a,b)=>a-b);
  const vyScores = [...new Set(Object.values(VER_SCORE))].sort((a,b)=>a-b);
  const vyMin = Math.min(...vyScores), vyMax = Math.max(...vyScores);
  const axMin = Math.min(...axRanks), axMax = Math.max(...axRanks);

  // Rows are positioned by their index in the score list, not by the score itself: the
  // scale skips 0 (there is no neutral grade), so spacing by value would leave a gap
  // twice the height of every other row straddling the zero line.
  const W = 470, H = 310, PADL = 108, PADR = 12, PADT = 10, PADB = 70;
  const rowOf = v => vyScores.indexOf(v);
  const cw = (W - PADL - PADR) / (axMax - axMin + 1);
  const ch = (H - PADT - PADB) / vyScores.length;
  const cx = a => PADL + (a - axMin + 0.5) * cw;
  const cy = v => H - PADB - (rowOf(v) + 0.5) * ch;

  // Area-proportional radius: doubling the count doubles the ink, not the width, which
  // is what makes 18 read as roughly twice 10 rather than four times it.
  const maxN = Math.max(...[...cells.values()].map(c => c.list.length));
  const rMax = Math.min(cw, ch) / 2 - 3;
  const rOf = n => Math.max(3.5, rMax * Math.sqrt(n / maxN));

  // A single label per autonomy column, rotated: the full labels ("Search scaffold")
  // do not fit horizontally in a half-width card.
  const AUT_BY_RANK = {};
  Object.entries(AUT_RANK).forEach(([slug, r]) => { AUT_BY_RANK[r] = slug; });
  const xlabels = axRanks.map(a => {
    const slug = AUT_BY_RANK[a];
    const x = cx(a).toFixed(1), y = H - PADB + 13;
    return `<text x="${x}" y="${y}" class="mx-tick" text-anchor="end"`+
      ` transform="rotate(-35 ${x} ${y})">${esc(AUT_LABEL[slug]||slug)}</text>`;
  }).join('');

  // One row label per distinct score. Grades that share a score share a row, so the
  // label names the row, not any single grade.
  const VROW = {4:'Formal', 3:'Independent / peer', 2:'Author verified', 1:'Claimed',
    '-1':'Already known', '-2':'Disputed', '-3':'Refuted'};
  const ylabels = vyScores.map(v =>
    `<text x="${PADL-9}" y="${(cy(v)+3.5).toFixed(1)}" class="mx-tick" text-anchor="end">`+
    `${esc(VROW[v]||v)}</text>`).join('');

  // Faint cell guides, plus the zero line: the boundary between evidence for a claim and
  // evidence against it is the one line on this axis worth drawing heavier. It sits on
  // the row boundary between the lowest positive score and the highest negative one.
  const firstPos = vyScores.findIndex(v => v > 0);
  const zeroY = firstPos > 0 ? H - PADB - firstPos * ch : null;
  const guides = vyScores.map(v =>
    `<line x1="${PADL}" y1="${cy(v).toFixed(1)}" x2="${W-PADR}" y2="${cy(v).toFixed(1)}" class="mx-guide"/>`).join('')
    + (zeroY != null
      ? `<line x1="${PADL}" y1="${zeroY.toFixed(1)}" x2="${W-PADR}" y2="${zeroY.toFixed(1)}" class="mx-zero"/>`
        + `<text x="${W-PADR}" y="${(zeroY-4).toFixed(1)}" class="mx-zlab" text-anchor="end">supports the claim ↑</text>`
        + `<text x="${W-PADR}" y="${(zeroY+11).toFixed(1)}" class="mx-zlab" text-anchor="end">counts against it ↓</text>`
      : '');

  const dots = [...cells.values()].map(c => {
    const n = c.list.length;
    const col = AUT_COLOR[AUT_BY_RANK[c.ax]] || 'var(--muted)';
    const names = c.list.slice(0,4).map(e=>e.title).join(' · ')
      + (n > 4 ? ` · +${n-4} more` : '');
    const vlab = VROW[c.vy] || c.vy, alab = AUT_LABEL[AUT_BY_RANK[c.ax]];
    return `<circle cx="${cx(c.ax).toFixed(1)}" cy="${cy(c.vy).toFixed(1)}" r="${rOf(n).toFixed(1)}"`+
      ` fill="${col}" class="mx-dot" tabindex="0" role="img"`+
      ` data-title="${esc(`${alab} · ${vlab}`)}"`+
      ` data-aut="${esc(`${n} finding${n===1?'':'s'}`)}"`+
      ` data-autcol="${col}"`+
      ` data-open="${esc(names)}"`+
      ` aria-label="${esc(`${alab}, ${vlab}: ${n} finding${n===1?'':'s'}.`)}"></circle>`+
      (n >= 4 ? `<text x="${cx(c.ax).toFixed(1)}" y="${(cy(c.vy)+3.5).toFixed(1)}"`+
        ` class="mx-n" text-anchor="middle">${n}</text>` : '');
  }).join('');

  const midY = (PADT + (H - PADB)) / 2;
  const axisTitles =
    `<text x="${(PADL+(W-PADR))/2}" y="${H-4}" class="sc-axis" text-anchor="middle">More AI-driven →</text>`+
    `<text x="10" y="${midY.toFixed(1)}" class="sc-axis" text-anchor="middle"`+
    ` transform="rotate(-90 10 ${midY.toFixed(1)})">Better evidence →</text>`;

  const summary = [...cells.values()].sort((a,b)=>b.list.length-a.list.length).slice(0,3)
    .map(c => `${AUT_LABEL[AUT_BY_RANK[c.ax]]} and ${VROW[c.vy]||c.vy}: ${c.list.length}`).join('; ');
  const label = `Matrix of verification against autonomy for ${pts.length} findings. `+
    `Circle area is the number of findings in each combination. Largest groups: ${summary}.`;
  const note = missing ? `<p class="qv-foot">${missing} entr${missing===1?'y':'ies'} not shown (unrecognised grade).</p>` : '';

  return `<div class="qv-card"><h3 class="qv-title">Evidence vs. autonomy</h3>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">`+
    guides + xlabels + ylabels + axisTitles + dots + `</svg>`+
    `<div class="sc-tip" hidden aria-hidden="true"></div>`+
    `</div>`+
    `<p class="qv-foot">Circle area = findings in that combination. All ${pts.length} entries carry both grades.</p>`+
    note + `</div>`;
}

// ---------- Chart builders shared by /visuals and the home page ----------
// These three are pure: same ALL in, same string out, no DOM. That is what lets
// build-site.py pre-render them for the home page and verify-parity.py diff the two
// implementations, exactly as it already does for card(), matrixCard() and tableView().
// They live here rather than inside renderCharts() for the same reason: a closure cannot
// be called from a parity check.

// rows are [label, count, swatch?, titleOverride?, cls?]. The override carries the long
// form (a full org name, or the roster behind an aggregated row) into the tooltip
// while the visible label stays short enough for the label column.
function hbarsHtml(rows, name){
  const max = Math.max(...rows.map(r=>r[1]), 1);
  const lab = name + '. ' + rows.map(([l,c])=>`${l}: ${c}`).join('; ');
  return `<div class="hbars" role="img" aria-label="${esc(lab)}">` + rows.map(([label,c,sw,tt,cls])=>
    `<div class="hbar${cls?' '+cls:''}" title="${esc(tt || `${label}: ${c}`)}">`+
    `<span class="hbar-label">${sw?`<i class="sw" style="background:${sw}"></i>`:''}${esc(label)}</span>`+
    `<span class="hbar-track"><span class="hbar-fill" style="width:${Math.round(c/max*100)}%"></span></span>`+
    `<span class="hbar-val">${c}</span></div>`).join('') + `</div>`;
}

// Time series: findings per year, gaps filled. Empty years are drawn rather than skipped
// because a gap is a fact about the registry, and a bar chart that closed up its own
// quiet years would read as steady output.
function yearCard(){
  const years = ALL.map(e=>+e.date.slice(0,4));
  const y0=Math.min(...years), y1=Math.max(...years), byYear=[];
  for (let y=y0; y<=y1; y++) byYear.push([y, years.filter(v=>v===y).length]);
  const ymax = Math.max(...byYear.map(d=>d[1]), 1);
  const vLabel = 'Findings per year. ' + byYear.map(([y,c])=>`${y}: ${c}`).join('; ');
  const bars = `<div class="vbars" role="img" aria-label="${esc(vLabel)}">` + byYear.map(([y,c])=>
    `<div class="vbar" title="${y}: ${c} finding${c===1?'':'s'}">`+
    `<span class="vbar-val">${c}</span>`+
    `<span class="vbar-fill" style="height:${Math.max(Math.round(c/ymax*72),2)}px"></span>`+
    `<span class="vbar-x">'${String(y).slice(2)}</span></div>`).join('') + `</div>`;
  return `<div class="qv-card"><h3 class="qv-title">Findings per year</h3>${bars}</div>`;
}

// Findings by topic area. `max` is a height budget, not a ranking: /visuals passes 0 and
// gets all of them, the home page passes a cap because the card is a quarter of the width
// there. The tail aggregates into one labelled row rather than being dropped, so the
// column still sums to the registry, the same way the lab chart handles its long tail.
function topicCard(max, cls){
  const m = {};
  ALL.forEach(e => { if (e.field != null) m[e.field] = (m[e.field]||0)+1; });
  const rows = Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([f,c]) => [FIELD_SHORT[f]||f, c]);
  const head = (max && rows.length > max) ? rows.slice(0, max-1) : rows;
  const rest = rows.slice(head.length);
  const out = head.slice();
  if (rest.length) out.push([`+${rest.length} more topics`, rest.reduce((s,r)=>s+r[1],0), null,
    `${rest.length} further topics: ` + rest.map(([l,c])=>`${l} (${c})`).join(', '), 'is-rollup']);
  return `<div class="qv-card${cls?' '+cls:''}"><h3 class="qv-title">By topic area</h3>`+
    hbarsHtml(out, 'By topic area') + `</div>`;
}

// The evidence chain: how many entries link each kind of source.
//
// Scaled to the registry, not to the tallest row the way hbarsHtml() is. This is
// coverage, so a bar is the share of entries carrying that kind of link at all: a kind
// nearly every entry has must read as nearly full. Max-scaling would draw the
// first at 100% and the second at 17%, which states the wrong thing about both. Counted
// once per entry per kind: one paper cited twice is not two papers.
//
// Rows follow vocabulary order (original work, claim, pushback), not count order, because
// that sequence is the point the card is making, and use the short SRC_CHIP form because
// the label column on the home page's quarter-width copy cannot hold the long one.
function evidenceCard(){
  const n = ALL.length;
  const perKind = {};
  SRC_ORDER.forEach(k => { perKind[k] = 0; });
  ALL.forEach(e => {
    new Set((e.sources||[]).map(s => s.kind)).forEach(k => {
      if (k in perKind) perKind[k]++;
    });
  });
  const label = `Entries linking each kind of source, out of ${n}. `+
    SRC_ORDER.map(k => `${SRC_LABEL[k]}: ${perKind[k]}`).join('; ');
  const bars = `<div class="hbars" role="img" aria-label="${esc(label)}">` +
    SRC_ORDER.map(k => {
      const c = perKind[k];
      return `<div class="hbar" title="${esc(SRC_LABEL[k])}: ${c} of ${n} entries">`+
        `<span class="hbar-label">`+
        `<i class="sw" style="background:var(--src-${esc(k)})"></i>`+
        `${esc(SRC_CHIP[k])}</span>`+
        `<span class="hbar-track"><span class="hbar-fill"`+
        ` style="width:${Math.round(c/n*100)}%"></span></span>`+
        `<span class="hbar-val">${c}</span></div>`;
    }).join('') + `</div>`;
  const noChallenge = n - (perKind.challenge || 0);
  return `<div class="qv-card"><h3 class="qv-title">Evidence chain</h3>${bars}`+
    `<p class="qv-foot">Of ${n} entries. `+
    `<a href="/review">${noChallenge} link no counterargument</a>: `+
    `a gap, not a consensus.</p></div>`;
}

// How long each problem had stood before it fell: the one place the registry can say
// something about the problems rather than about the systems that closed them.
//
// Longest first, then newest result, then id. The tiebreak is load-bearing rather than
// cosmetic, the same way the activity feed's is: build-site.py renders this card into
// index.html, CI diffs those bytes, and an unstable order would fail the build on an
// unrelated change. Compared with < and > rather than localeCompare so the ordering is
// code-point ordering, which is what Python's sorted() does on the other side.
function standingCard(max, cls){
  const standing = ALL.filter(e => yearsOpen(e) != null)
    .map(e => [yearsOpen(e), e])
    .sort((a,b) => b[0]-a[0]
      || cmpDesc(a[1].date||'', b[1].date||'')
      || cmpDesc(a[1].id||'', b[1].id||''));
  const rows = standing.slice(0, max).map(([yrs,e]) =>
    `<li><a href="/finding/${esc(e.id)}">`+
    `<b>${yrs} yr</b><span>${esc(e.title)}</span>`+
    `<em>posed ${e.year_posed} · ${esc(e.model || 'Unknown')}</em>`+
    `</a></li>`).join('');
  return `<div class="qv-card${cls?' '+cls:''}"><h3 class="qv-title">Open longest before falling</h3>`+
    `<ol class="standing">${rows}</ol>`+
    `<p class="qv-foot">From the ${standing.length} of ${ALL.length} entries `+
    `recording a posed year. <a href="/review">Add a missing one</a>.</p></div>`;
}

/** Descending string compare by code point, for the sort tiebreaks above. */
function cmpDesc(a, b){ return b > a ? 1 : b < a ? -1 : 0; }

// Long organisation names get ellipsised to nothing useful in the label column
// ('Lawrence Berkeley Natior…'), so shorten the known offenders to the name people
// actually use. The full name stays in the row's title attribute and aria-label.
const LAB_SHORT = {
  'Lawrence Berkeley National Laboratory':'Berkeley Lab',
  'Google DeepMind (with Brown, NYU and Stanford)':'DeepMind + universities',
  'Google DeepMind (with Oxford and Sydney)':'DeepMind + Oxford/Sydney',
  'Google DeepMind / Isomorphic Labs':'DeepMind / Isomorphic',
  'Google DeepMind / Google Quantum AI':'DeepMind / Quantum AI',
  'Google Brain / University of Texas at Austin':'Google Brain / UT Austin',
  'Institute for Protein Design, University of Washington':'IPD, U. Washington',
  'Princeton University / PPPL / DIII-D National Fusion Facility':'Princeton / PPPL',
  'FlyWire Consortium (Princeton, MRC LMB, Cambridge, Vermont)':'FlyWire Consortium',
  'Arc Institute / Stanford University':'Arc Institute / Stanford',
  'MIT / Broad Institute / Harvard':'MIT / Broad / Harvard',
  'UT Austin / CWI Amsterdam':'UT Austin / CWI'
};

// ---------- Charts /visuals mounts and the home page does not ----------
// These three have no port in build-site.py and no parity row, because nothing
// pre-renders them: /visuals is the only page that shows them, and it fetches the
// registry and renders client side. Keep it that way. A card that ever needs to appear
// on the home page has to be ported first, like the five above.

// `model` is deliberately precise about what ran, so nearly every entry carries a
// distinct string and a raw tally is a list of ones. Group on the system rather than the release:
// the question the card answers is which systems produce findings, not which point
// version did. Same shape as LAB_SHORT above, and an unlisted model still renders, it
// just counts as its own row until it is named here.
const MODEL_FAMILY = [
  [/^AlphaEvolve/i, 'AlphaEvolve'],
  [/^FunSearch/i, 'FunSearch'],
  [/^AlphaFold/i, 'AlphaFold'],
  [/^AlphaProof|^AlphaGeometry/i, 'AlphaProof / AlphaGeometry'],
  [/^AlphaTensor|^AlphaDev|^AlphaQubit|^AlphaMissense/i, 'AlphaZero-line systems'],
  [/\bGPT-5|\bGPT-4/i, 'GPT-5 family'],
  [/^Claude|\bClaude Fable/i, 'Claude'],
  [/^Gemini|Deep Think/i, 'Gemini'],
  [/^Aristotle|^Gauss\b|^Harmonic/i, 'Formal-proof agents'],
  [/neural network|graph neural|Chemprop|convolutional|segmentation|networks/i,
   'Purpose-built neural networks'],
  [/reinforcement learning|RL controller/i, 'RL controllers'],
  [/multi-agent|Co-Scientist|Coscientist|AI Scientist|Robin/i, 'Agent systems'],
];
function modelFamily(model){
  const s = String(model || '');
  const hit = MODEL_FAMILY.find(([re]) => re.test(s));
  return hit ? hit[1] : s;
}

// Findings by AI system, grouped into families. Same long-tail handling as the lab card:
// the singles aggregate into one labelled row rather than being dropped, so the column
// still sums to the registry.
function modelCard(cls){
  const m = {};
  ALL.forEach(e => { const k = modelFamily(e.model); if (k) m[k] = (m[k]||0)+1; });
  const rows = Object.entries(m).sort((a,b)=>b[1]-a[1]);
  const ranked = rows.filter(([,c]) => c > 1);
  const singles = rows.filter(([,c]) => c <= 1);
  const out = ranked.slice();
  if (singles.length) out.push([`+${singles.length} more, 1 each`, singles.length, null,
    `${singles.length} further systems with one finding each: `+
    singles.map(([l])=>l).join(', '), 'is-rollup']);
  return `<div class="qv-card${cls?' '+cls:''}"><h3 class="qv-title">By AI system</h3>`+
    hbarsHtml(out, 'By AI system')+
    `<p class="qv-foot">Grouped by system, not by release: GPT-5 Pro and GPT-5.6 Pro `+
    `count together. Purpose-built networks are models trained for one problem, as `+
    `against a general model prompted at it.</p></div>`;
}

// Who has actually looked. An entry with no independent_checks has been read by nobody
// outside the lab that announced it, which is the number /review exists to move, so the
// card splits by grade rather than giving one total: an unchecked 'formal' and an
// unchecked 'claimed' are not the same problem.
function coverageCard(cls){
  const checked = ALL.filter(e => (e.independent_checks||[]).length).length;
  const rows = GRADE_ORDER.filter(g => ALL.some(e => e.verification === g))
    .map(g => {
      const of = ALL.filter(e => e.verification === g);
      const without = of.filter(e => !(e.independent_checks||[]).length).length;
      return [GRADE_SHORT[g]||g, without, `var(${GRADE_VAR[g]})`,
        `${GRADE_SHORT[g]||g}: ${without} of ${of.length} still unchecked`];
    });
  return `<div class="qv-card${cls?' '+cls:''}">`+
    `<h3 class="qv-title">Still unchecked, by grade</h3>`+
    hbarsHtml(rows, 'Entries with no independent check, by verification grade')+
    `<p class="qv-foot">${ALL.length - checked} of ${ALL.length} entries have never been `+
    `checked outside the lab that announced them. `+
    `<a href="/review">Open the review queue</a>.</p></div>`;
}

// ---------- Shared plot helpers for the /visuals charts below ----------
// Pure like everything else in this section: numbers in, SVG string out. They are shared
// so the five plots agree on tick spacing, axis chrome and mark colouring instead of each
// inventing its own.

// Autonomy is this registry's own axis, so it is the colour key of every chart that splits
// by it. These are the --aut-* tokens rather than AUT_COLOR's grade tokens: the two hold
// the same hues today, but a grade token is the wrong thing to reach for when the thing
// being coloured is not a grade, and AUT_COLOR belongs to the parity-checked matrix.
const AUT_VAR = {
  'autonomous':'var(--aut-autonomous)','ai-led':'var(--aut-ai-led)',
  'collaborative':'var(--aut-collaborative)','ai-assisted':'var(--aut-ai-assisted)',
  'search-scaffold':'var(--aut-search-scaffold)','retrieval':'var(--aut-retrieval)'
};
// Least AI-driven first, so a stack reads bottom-up in the same direction the matrix reads
// left to right, and the search-scaffold era sits under the AI-led one that follows it.
const AUT_ORDER = Object.keys(AUT_RANK).sort((a,b) => AUT_RANK[a] - AUT_RANK[b]);

/** Round ticks at 1, 2 or 5 times a power of ten, covering 0 to max. */
function niceTicks(max, want){
  if (!(max > 0)) return [0];
  const mag = Math.pow(10, Math.floor(Math.log10(max / want)));
  const norm = (max / want) / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  // Round up past the largest value rather than stopping under it. Stopping under it puts
  // real data outside the axis, which the span chart then has to draw as an overflow.
  const top = Math.ceil(max / step) * step;
  const out = [];
  for (let v = 0; v <= top + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** The domain a set of ticks spans, which is what every scale below should divide by. */
function tickTop(ticks){ return ticks[ticks.length - 1] || 1; }

/** Horizontal gridlines plus their value labels, drawn behind the marks. */
function yGrid(ticks, yOf, x0, x1){
  return ticks.map(t =>
    `<line x1="${x0}" y1="${yOf(t).toFixed(1)}" x2="${x1}" y2="${yOf(t).toFixed(1)}" class="mx-guide"/>`+
    `<text x="${x0-7}" y="${(yOf(t)+3.5).toFixed(1)}" class="mx-tick" text-anchor="end">${t}</text>`
  ).join('');
}

/** A clickable key per series. Identity is never colour alone: every key carries its name. */
function legendHtml(series, labelOf, colorOf){
  return `<div class="qv-legend">` + series.map(s =>
    `<button type="button" class="qv-key" data-ser="${esc(s)}" aria-pressed="false">`+
    `<i class="sw" style="background:${colorOf(s)}"></i>${esc(labelOf(s))}</button>`).join('') + `</div>`;
}

/** The two-state view switch used by the trend and mix cards. */
function segHtml(views, current){
  return `<div class="qv-seg" role="group">` + views.map(([v,label]) =>
    `<button type="button" data-view="${esc(v)}" aria-pressed="${v===current}">${esc(label)}</button>`
  ).join('') + `</div>`;
}

/** Per-year counts by autonomy, gap years filled. Shared by the trend and mix cards. */
function autoByYear(){
  const years = ALL.map(e => +e.date.slice(0,4));
  const y0 = Math.min(...years), y1 = Math.max(...years), span = [];
  for (let y = y0; y <= y1; y++) span.push(y);
  const series = AUT_ORDER.filter(a => ALL.some(e => e.autonomy === a));
  const per = {};
  series.forEach(a => { per[a] = span.map(y =>
    ALL.filter(e => e.autonomy === a && +e.date.slice(0,4) === y).length); });
  return { span, series, per };
}

// The page's centrepiece: how the registry filled up, and what it filled up with. Cumulative
// is the honest time encoding for 77 entries over ten years, because raw monthly counts are
// mostly ones and read as noise; the per-year view is a toggle rather than a second card so
// both states describe the same whole registry, which is what the lede promises.
function trendCard(){
  const { span, series, per } = autoByYear();
  const cum = {};
  series.forEach(a => { let t = 0; cum[a] = per[a].map(v => (t += v)); });

  const W = 940, H = 330, PADL = 46, PADR = 18, PADT = 18, PADB = 46;
  const x0 = PADL, x1 = W - PADR, yTop = PADT, yBot = H - PADB;
  const step = span.length > 1 ? (x1 - x0) / (span.length - 1) : 0;
  const x = i => x0 + i * step;
  const bw = (x1 - x0) / span.length;

  const totalCum = span.map((_, i) => series.reduce((s,a) => s + cum[a][i], 0));
  const totalPer = span.map((_, i) => series.reduce((s,a) => s + per[a][i], 0));
  const tickC = niceTicks(Math.max(...totalCum, 1), 4), domC = tickTop(tickC);
  const tickP = niceTicks(Math.max(...totalPer, 1), 4), domP = tickTop(tickP);
  const yC = v => yBot - v / domC * (yBot - yTop);
  const yP = v => yBot - v / domP * (yBot - yTop);

  // One hit target per year spanning the plot height, so the tooltip does not depend on
  // landing on a band edge. Built per view because the two views report different numbers.
  const hits = (counts, label) => span.map((y,i) => {
    const parts = series.map(a => [AUT_LABEL[a]||a, counts[a][i]]).filter(p => p[1] > 0)
      .sort((p,q) => q[1] - p[1]).map(p => `${p[0]}: ${p[1]}`).join(' · ');
    const tot = series.reduce((s,a) => s + counts[a][i], 0);
    return `<rect class="pt-mark pt-hit" x="${(x(i)-bw/2).toFixed(1)}" y="${yTop}"`+
      ` width="${bw.toFixed(1)}" height="${(yBot-yTop).toFixed(1)}" tabindex="0" role="img"`+
      ` data-title="${y}" data-aut="${esc(`${tot} ${label}`)}" data-autcol="var(--accent)"`+
      ` data-open="${esc(parts || 'No findings this year')}"`+
      ` aria-label="${esc(`${y}: ${tot} ${label}. ${parts}`)}"></rect>`;
  }).join('');

  // Stacked bands, drawn bottom up. The 1.5px panel-coloured stroke is the gap between
  // fills rather than a border around them.
  let base = span.map(() => 0);
  const bands = series.map(a => {
    const lower = base.slice(), upper = base.map((b,i) => b + cum[a][i]);
    base = upper;
    const top = upper.map((v,i) => `${x(i).toFixed(1)},${yC(v).toFixed(1)}`).join(' ');
    const bot = lower.map((v,i) => `${x(i).toFixed(1)},${yC(v).toFixed(1)}`).reverse().join(' ');
    return `<polygon class="ser" data-ser="${esc(a)}" points="${top} ${bot}"`+
      ` fill="${AUT_VAR[a]}" stroke="var(--panel)" stroke-width="1.5"/>`;
  }).join('');

  let pbase = span.map(() => 0);
  const cols = series.map(a => {
    const segs = span.map((_,i) => {
      const v = per[a][i];
      if (!v) return '';
      const y = yP(pbase[i] + v), h = yP(pbase[i]) - yP(pbase[i] + v);
      return `<rect x="${(x(i)-bw*0.34).toFixed(1)}" y="${y.toFixed(1)}"`+
        ` width="${(bw*0.68).toFixed(1)}" height="${Math.max(h,1).toFixed(1)}"`+
        ` fill="${AUT_VAR[a]}" stroke="var(--panel)" stroke-width="1.5"/>`;
    }).join('');
    span.forEach((_,i) => { pbase[i] += per[a][i]; });
    return `<g class="ser" data-ser="${esc(a)}">${segs}</g>`;
  }).join('');

  const xlabels = span.map((y,i) =>
    `<text x="${x(i).toFixed(1)}" y="${H-PADB+16}" class="mx-tick" text-anchor="middle">'${String(y).slice(2)}</text>`
  ).join('');

  const total = ALL.length;
  const lab = `Findings over time by autonomy. Cumulative total reaches ${total} by ${span[span.length-1]}. `+
    series.map(a => `${AUT_LABEL[a]||a}: ${cum[a][cum[a].length-1]}`).join('; ') + '.';

  return `<div class="qv-card qv-hero" data-view="cum">`+
    `<div class="qv-head"><h3 class="qv-title">Findings over time, by autonomy</h3>`+
    segHtml([['cum','Cumulative'],['yr','Per year']], 'cum')+`</div>`+
    legendHtml(series, a => AUT_LABEL[a]||a, a => AUT_VAR[a])+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lab)}" preserveAspectRatio="xMidYMid meet">`+
    `<g class="v-cum">${yGrid(tickC, yC, x0, x1)}${bands}${hits(cum,'in total')}</g>`+
    `<g class="v-yr">${yGrid(tickP, yP, x0, x1)}${cols}${hits(per,'that year')}</g>`+
    xlabels+
    `<text x="14" y="${((yTop+yBot)/2).toFixed(1)}" class="sc-axis" text-anchor="middle"`+
    ` transform="rotate(-90 14 ${((yTop+yBot)/2).toFixed(1)})">Findings</text>`+
    `</svg><div class="sc-tip" hidden aria-hidden="true"></div></div>`+
    `<p class="qv-foot">Dated by when the result became public, not when it was added here. `+
    `Cumulative reaches ${total}. Click a key to isolate one band.</p></div>`;
}

// The composition shift is the one real trend in the data and a count chart hides it, because
// 2026 is taller than every earlier year put together. Share puts every year on the same
// footing; the caption carries the warning that the early years rest on very few entries.
function mixCard(){
  const { span, series, per } = autoByYear();
  const W = 470, H = 300, PADL = 34, PADR = 12, PADT = 14, PADB = 44;
  const x0 = PADL, x1 = W - PADR, yTop = PADT, yBot = H - PADB;
  const bw = (x1 - x0) / span.length;
  const tot = span.map((_,i) => series.reduce((s,a) => s + per[a][i], 0));
  const tickP = niceTicks(Math.max(...tot, 1), 4), domP = tickTop(tickP);

  const build = (mode) => {
    let base = span.map(() => 0);
    return series.map(a => {
      const segs = span.map((_,i) => {
        const v = per[a][i];
        if (!v || (mode === 'share' && !tot[i])) return '';
        const denom = mode === 'share' ? tot[i] : domP;
        const yA = yBot - (base[i] + v) / denom * (yBot - yTop);
        const yB = yBot - base[i] / denom * (yBot - yTop);
        return `<rect x="${(x0+i*bw+bw*0.16).toFixed(1)}" y="${yA.toFixed(1)}"`+
          ` width="${(bw*0.68).toFixed(1)}" height="${Math.max(yB-yA,1).toFixed(1)}"`+
          ` fill="${AUT_VAR[a]}" stroke="var(--panel)" stroke-width="1.2"/>`;
      }).join('');
      span.forEach((_,i) => { base[i] += per[a][i]; });
      return `<g class="ser" data-ser="${esc(a)}">${segs}</g>`;
    }).join('');
  };

  const hits = span.map((y,i) => {
    const parts = series.map(a => [AUT_LABEL[a]||a, per[a][i]]).filter(p => p[1] > 0)
      .sort((p,q) => q[1] - p[1])
      .map(p => `${p[0]}: ${p[1]}${tot[i] ? ` (${Math.round(p[1]/tot[i]*100)}%)` : ''}`).join(' · ');
    return `<rect class="pt-mark pt-hit" x="${(x0+i*bw).toFixed(1)}" y="${yTop}"`+
      ` width="${bw.toFixed(1)}" height="${(yBot-yTop).toFixed(1)}" tabindex="0" role="img"`+
      ` data-title="${y}" data-aut="${esc(`${tot[i]} finding${tot[i]===1?'':'s'}`)}"`+
      ` data-autcol="var(--accent)" data-open="${esc(parts || 'No findings this year')}"`+
      ` aria-label="${esc(`${y}: ${tot[i]} findings. ${parts}`)}"></rect>`;
  }).join('');

  const thin = span.filter((_,i) => tot[i] > 0 && tot[i] < 4).length;
  const lab = 'Share of findings by autonomy each year. ' + span.map((y,i) =>
    `${y}: ${tot[i]}`).join('; ') + '.';

  return `<div class="qv-card" data-view="share">`+
    `<div class="qv-head"><h3 class="qv-title">What each year was made of</h3>`+
    segHtml([['share','Share'],['count','Count']], 'share')+`</div>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lab)}" preserveAspectRatio="xMidYMid meet">`+
    `<g class="v-share">${yGrid([0,25,50,75,100], v => yBot - v/100*(yBot-yTop), x0, x1)}${build('share')}${hits}</g>`+
    `<g class="v-count">${yGrid(tickP, v => yBot - v/domP*(yBot-yTop), x0, x1)}${build('count')}${hits}</g>`+
    span.map((y,i) => `<text x="${(x0+i*bw+bw/2).toFixed(1)}" y="${H-PADB+15}" class="mx-tick" text-anchor="middle">'${String(y).slice(2)}</text>`).join('')+
    `</svg><div class="sc-tip" hidden aria-hidden="true"></div></div>`+
    `<p class="qv-foot">Share puts thin years beside full ones. ${thin} year${thin===1?'':'s'} `+
    `rest on fewer than four findings, so read the left of this chart as direction, not rate.</p></div>`;
}

// Whether the checking keeps pace with the output, which is the question this project
// exists to move. Two cumulative lines and the gap between them: an emphasis chart rather
// than a categorical one, because the subject is not which line is which, it is how far
// apart they have grown. The earlier version of this card plotted the delay between a
// result and its entry here, which looked like a scatter but was not one: every entry was
// added inside the same few weeks, so that delay was only the date axis restated.
function checkedCard(){
  const years = ALL.map(e => +e.date.slice(0,4));
  const y0 = Math.min(...years), y1 = Math.max(...years), span = [];
  for (let y = y0; y <= y1; y++) span.push(y);
  let a = 0, b = 0;
  const tot = [], chk = [];
  span.forEach(y => {
    const of = ALL.filter(e => +e.date.slice(0,4) === y);
    a += of.length;
    b += of.filter(e => (e.independent_checks||[]).length).length;
    tot.push(a); chk.push(b);
  });

  const W = 470, H = 300, PADL = 34, PADR = 62, PADT = 16, PADB = 44;
  const x0 = PADL, x1 = W - PADR, yTop = PADT, yBot = H - PADB;
  const ticks = niceTicks(Math.max(a, 1), 4), dom = tickTop(ticks);
  const step = span.length > 1 ? (x1 - x0) / (span.length - 1) : 0;
  const x = i => x0 + i * step, y = v => yBot - v / dom * (yBot - yTop);
  const path = arr => arr.map((v,i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // The gap is the subject, so it is filled rather than left as empty space between lines.
  const gap = `<polygon class="ck-gap" points="${path(tot)} ${chk.map((v,i) =>
    `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(' ')}"/>`;

  const hits = span.map((yr,i) => {
    const pc = tot[i] ? Math.round(chk[i] / tot[i] * 100) : 0;
    return `<rect class="pt-mark pt-hit" x="${(x(i)-(step||10)/2).toFixed(1)}" y="${yTop}"`+
      ` width="${(step||10).toFixed(1)}" height="${(yBot-yTop).toFixed(1)}" tabindex="0" role="img"`+
      ` data-title="${yr}" data-aut="${esc(`${chk[i]} of ${tot[i]} checked`)}"`+
      ` data-autcol="var(--src-research)"`+
      ` data-open="${esc(`${pc}% of the registry up to this point had an independent check`)}"`+
      ` aria-label="${esc(`By ${yr}: ${chk[i]} of ${tot[i]} findings independently checked.`)}"></rect>`;
  }).join('');

  // Direct labels at the line ends rather than a legend box: two series, and the label sits
  // on the thing it names, so neither line is identified by its colour alone.
  const endLab = (v, cls, text) =>
    `<text x="${x1+6}" y="${(y(v)+3.5).toFixed(1)}" class="ck-end ${cls}">${esc(text)}</text>`;

  const pc = a ? Math.round(b / a * 100) : 0;
  return `<div class="qv-card">`+
    `<div class="qv-head"><h3 class="qv-title">Has the checking kept up?</h3></div>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img"`+
    ` aria-label="${esc(`Cumulative findings against cumulative independently checked findings, ${y0} to ${y1}. ${a} recorded, ${b} checked, ${pc} percent.`)}"`+
    ` preserveAspectRatio="xMidYMid meet">`+
    yGrid(ticks, y, x0, x1) + gap +
    `<polyline class="ck-line ck-tot" points="${path(tot)}"/>`+
    `<polyline class="ck-line ck-chk" points="${path(chk)}"/>`+
    endLab(a, 'ck-tot-t', `${a} recorded`) + endLab(b, 'ck-chk-t', `${b} checked`) + hits +
    span.map((yr,i) => `<text x="${x(i).toFixed(1)}" y="${H-PADB+16}" class="mx-tick" text-anchor="middle">'${String(yr).slice(2)}</text>`).join('')+
    `</svg><div class="sc-tip" hidden aria-hidden="true"></div></div>`+
    `<p class="qv-foot">The shaded gap is what nobody outside the announcing lab has `+
    `confirmed: ${a-b} of ${a} entries. <a href="/review">Open the review queue</a>.</p></div>`;
}

// Topic against grade. Two long bar charts said which topics and which grades separately;
// this says which grades each topic actually earns, which is where the pattern is: formal
// proof is almost entirely mathematics, and every disputed entry is materials science.
function fieldGradeCard(){
  const grades = GRADE_ORDER.filter(g => ALL.some(e => e.verification === g));
  const totals = {};
  ALL.forEach(e => { totals[e.field] = (totals[e.field]||0) + 1; });
  const fields = Object.keys(totals).sort((a,b) => totals[b]-totals[a] || (a<b?-1:1));
  const at = (f,g) => ALL.filter(e => e.field === f && e.verification === g).length;
  const maxN = Math.max(...fields.map(f => Math.max(...grades.map(g => at(f,g)))), 1);

  const W = 470, PADL = 104, PADR = 12, PADT = 58, PADB = 12, GAP = 9;
  const cw = (W - PADL - PADR) / grades.length, ch = 22;
  const totRow = PADT + fields.length * ch + GAP;
  const H = totRow + ch + PADB;

  const cells = fields.map((f,r) => grades.map((g,c) => {
    const n = at(f,g);
    const xx = PADL + c*cw, yy = PADT + r*ch;
    // Sequential single hue: opacity carries magnitude, so an empty cell is visibly empty
    // rather than a second colour meaning zero.
    // Area-proportional ink, like the matrix: the square root keeps 20 reading as roughly
    // twice 5 rather than four times it.
    const op = n ? 0.16 + 0.84 * Math.sqrt(n / maxN) : 0;
    return `<rect class="hm-cell${n?' pt-mark':''}" x="${(xx+0.6).toFixed(1)}" y="${(yy+0.6).toFixed(1)}"`+
      ` width="${(cw-1.2).toFixed(1)}" height="${(ch-1.2).toFixed(1)}" rx="3"`+
      ` fill="var(--accent)" fill-opacity="${op.toFixed(3)}"`+
      (n ? ` tabindex="0" role="img" data-title="${esc(`${FIELD_SHORT[f]||f} · ${GRADE_SHORT[g]||g}`)}"`+
        ` data-aut="${esc(`${n} finding${n===1?'':'s'}`)}" data-autcol="var(${GRADE_VAR[g]})"`+
        ` data-open="${esc(`${totals[f]} in ${FIELD_SHORT[f]||f} altogether`)}"`+
        ` aria-label="${esc(`${FIELD_SHORT[f]||f}, ${GRADE_SHORT[g]||g}: ${n}.`)}"` : ' aria-hidden="true"')+
      `/>`+
      (n ? `<text class="hm-n" x="${(xx+cw/2).toFixed(1)}" y="${(yy+ch/2+3.5).toFixed(1)}"`+
        ` text-anchor="middle" style="fill:var(${op > 0.55 ? '--panel' : '--ink'})">${n}</text>` : '');
  }).join('')).join('');

  const rows = fields.map((f,r) =>
    `<text x="${PADL-8}" y="${(PADT + r*ch + ch/2 + 3.5).toFixed(1)}" class="mx-tick" text-anchor="end">`+
    `${esc(FIELD_SHORT[f]||f)}</text>`).join('');
  const cols = grades.map((g,c) => {
    const xx = (PADL + c*cw + cw/2).toFixed(1);
    return `<text x="${xx}" y="${PADT-10}" class="mx-tick" text-anchor="start"`+
      ` transform="rotate(-52 ${xx} ${PADT-10})">${esc(GRADE_SHORT[g]||g)}</text>`;
  }).join('');

  // A totals row, so this card also answers "how many of each grade altogether" and the
  // page does not need a separate grade tally beside it.
  const colTot = grades.map(g => ALL.filter(e => e.verification === g).length);
  const totals_row =
    `<line x1="${PADL}" y1="${(totRow-GAP/2).toFixed(1)}" x2="${W-PADR}" y2="${(totRow-GAP/2).toFixed(1)}" class="mx-guide"/>`+
    `<text x="${PADL-8}" y="${(totRow + ch/2 + 3.5).toFixed(1)}" class="mx-tick hm-tot" text-anchor="end">All topics</text>`+
    grades.map((g,c) =>
      `<text class="hm-n hm-tot" x="${(PADL + c*cw + cw/2).toFixed(1)}" y="${(totRow + ch/2 + 3.5).toFixed(1)}"`+
      ` text-anchor="middle" style="fill:var(${GRADE_VAR[g]})">${colTot[c]}</text>`).join('');

  const lab = 'Topic area against verification grade. ' + fields.slice(0,4).map(f =>
    `${FIELD_SHORT[f]||f}: ` + grades.filter(g => at(f,g)).map(g => `${GRADE_SHORT[g]||g} ${at(f,g)}`).join(', ')
  ).join('; ') + '.';

  return `<div class="qv-card">`+
    `<div class="qv-head"><h3 class="qv-title">Topic area vs. grade</h3></div>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lab)}" preserveAspectRatio="xMidYMid meet">`+
    cols + rows + cells + totals_row +
    `</svg><div class="sc-tip" hidden aria-hidden="true"></div></div>`+
    `<p class="qv-foot">Stronger colour is more findings. Rows are ordered by size; the thin rows near `+
    `the bottom hold one or two entries each. The last row is the whole registry.</p></div>`;
}

// Who earns which grade. The two organisations with the most entries reach them by opposite
// routes, which neither a lab tally nor a grade tally can show on its own.
function labGradeCard(){
  const grades = GRADE_ORDER.filter(g => ALL.some(e => e.verification === g));
  const totals = {};
  ALL.forEach(e => { totals[e.lab] = (totals[e.lab]||0) + 1; });
  const ranked = Object.keys(totals).sort((a,b) => totals[b]-totals[a] || (a<b?-1:1));
  const TOP = 6;
  const shown = ranked.slice(0, TOP), rest = ranked.slice(TOP);
  const rowsOf = lab => grades.map(g => ALL.filter(e => e.lab === lab && e.verification === g).length);
  const restRow = grades.map(g => rest.reduce((s,l) =>
    s + ALL.filter(e => e.lab === l && e.verification === g).length, 0));

  const data = shown.map(l => [LAB_SHORT[l] || l, rowsOf(l), totals[l], l])
    .concat(rest.length ? [[`+${rest.length} more`, restRow, rest.reduce((s,l)=>s+totals[l],0), null]] : []);
  const max = Math.max(...data.map(d => d[2]), 1);

  const bars = data.map(([label, counts, tot, full]) => {
    let acc = 0;
    const segs = grades.map((g,i) => {
      const v = counts[i];
      if (!v) return '';
      const left = acc / max * 100, width = v / max * 100;
      acc += v;
      return `<span class="lg-seg ser" data-ser="${esc(g)}" style="left:${left.toFixed(2)}%;`+
        `width:${width.toFixed(2)}%;background:var(${GRADE_VAR[g]})"`+
        ` title="${esc(`${full||label} · ${GRADE_SHORT[g]||g}: ${v}`)}"></span>`;
    }).join('');
    return `<div class="lg-row${full?'':' is-rollup'}" title="${esc(full ? `${full}: ${tot}` : `${rest.length} further organisations: ${tot}`)}">`+
      `<span class="hbar-label">${esc(label)}</span>`+
      `<span class="lg-track">${segs}</span>`+
      `<span class="hbar-val">${tot}</span></div>`;
  }).join('');

  const lab = 'Verification grades by organisation. ' + data.map(([l,c,t]) =>
    `${l}: ${t} (` + grades.map((g,i) => c[i] ? `${GRADE_SHORT[g]||g} ${c[i]}` : '')
      .filter(Boolean).join(', ') + ')').join('; ') + '.';

  return `<div class="qv-card">`+
    `<div class="qv-head"><h3 class="qv-title">How each lab's evidence lands</h3></div>`+
    legendHtml(grades, g => GRADE_SHORT[g]||g, g => `var(${GRADE_VAR[g]})`)+
    `<div class="lg-bars" role="img" aria-label="${esc(lab)}">${bars}</div>`+
    `<p class="qv-foot">Bars are counts on one shared scale, so row length is output and `+
    `colour is how that output was checked.</p></div>`;
}

// How long the problems stood. The five buckets this replaces stated the shape at a
// resolution the data does not have; 29 values fit on one axis individually, and colouring
// them by grade answers the question the buckets raised, which is whether the old problems
// are the well-evidenced ones.
function spanCard(){
  const pts = ALL.map(e => ({ e, n: yearsOpen(e) })).filter(p => p.n != null)
    .sort((a,b) => a.n - b.n || (a.e.id < b.e.id ? -1 : 1));
  if (!pts.length){
    return `<div class="qv-card"><h3 class="qv-title">How long the problem stood</h3>`+
      `<p class="qv-empty">No entry records the year its problem was posed.</p></div>`;
  }
  const W = 470, PADL = 34, PADR = 16, PADT = 14, PADB = 46, R = 4.5, ROW = 10;
  const x0 = PADL, x1 = W - PADR;
  // One value sits far beyond the rest, so the axis stops at a round number above the others
  // and that entry is drawn in the last column with a marker, rather than compressing
  // everything else into the left third.
  const inliers = pts.filter(p => p.n <= 120);
  const cap = Math.max(...niceTicks(Math.max(...inliers.map(p => p.n), 10), 5));
  // A dot histogram rather than a strip: binning makes the vertical axis mean something
  // (how many entries stood that long) instead of being free space to scatter into.
  const BINS = 20, binW = cap / BINS;
  const binOf = v => Math.min(Math.floor(v / binW), BINS - 1);
  const x = v => x0 + (binOf(v) + 0.5) * (x1 - x0) / BINS;
  // Place first, then size the card to the tallest column.
  const col = {};
  const placed = pts.map(p => {
    const b = binOf(p.n);
    return { p, tier: (col[b] = (col[b] || 0) + 1) - 1 };
  });
  const H = PADT + (Math.max(...placed.map(d => d.tier)) + 1) * ROW + 12 + PADB;
  const yTop = PADT, yBot = H - PADB;

  const ticks = niceTicks(cap, 5).map(t =>
    `<line x1="${x(t).toFixed(1)}" y1="${yTop}" x2="${x(t).toFixed(1)}" y2="${yBot}" class="mx-guide"/>`+
    `<text x="${x(t).toFixed(1)}" y="${yBot+16}" class="mx-tick" text-anchor="middle">${t}</text>`).join('');

  // Deterministic stacking rather than random jitter: entries in the same bin pile upward in
  // a fixed order, so the picture is identical on every load.
  const dots = placed.map(({ p, tier }) => {
    const cy = yBot - R - 2 - tier * ROW;
    const out = p.n > cap;
    return `<circle class="pt-mark${out?' is-out':''}" cx="${x(p.n).toFixed(1)}" cy="${Math.max(cy,yTop+R).toFixed(1)}" r="${R}"`+
      ` fill="var(${GRADE_VAR[p.e.verification]||'--muted'})" tabindex="0" role="img"`+
      ` data-title="${esc(p.e.title)}"`+
      ` data-aut="${esc(`${p.n} years open`)}" data-autcol="var(${GRADE_VAR[p.e.verification]||'--muted'})"`+
      ` data-open="${esc(`Posed ${p.e.year_posed} · ${VER_LABEL[p.e.verification]||p.e.verification}`)}"`+
      ` aria-label="${esc(`${p.e.title}: open ${p.n} years, ${VER_LABEL[p.e.verification]||p.e.verification}.`)}"></circle>`;
  }).join('');

  const over = pts.filter(p => p.n > cap).length;
  const note = over ? `<p class="qv-foot">${over} entr${over===1?'y':'ies'} beyond ${cap} years `+
    `${over===1?'is':'are'} drawn on the right edge, ringed, so the rest keep the axis.</p>` : '';

  return `<div class="qv-card">`+
    `<div class="qv-head"><h3 class="qv-title">How long the problem stood</h3></div>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img"`+
    ` aria-label="${esc(`Years each problem stood before the result, for ${pts.length} entries, coloured by verification grade.`)}"`+
    ` preserveAspectRatio="xMidYMid meet">`+
    ticks + dots +
    `<text x="${((x0+x1)/2).toFixed(1)}" y="${H-6}" class="sc-axis" text-anchor="middle">Years open before the result</text>`+
    `</svg><div class="sc-tip" hidden aria-hidden="true"></div></div>`+
    `<p class="qv-foot">One dot per entry, coloured by grade. From the ${pts.length} of `+
    `${ALL.length} entries recording a posed year. <a href="/review">Add a missing one</a>.</p>`+
    note + `</div>`;
}

// Where else each finding is recorded. The one chart here that no other registry could
// draw, because this is the only one of the five that records the other four.
//
// Scaled to the whole registry rather than to the tallest bar, the way evidenceCard() is:
// the question is what share of the registry a second project has also seen, and a
// max-scaled bar would draw the largest registry as full coverage whatever its count.
function registryCard(cls){
  const n = ALL.length;
  const order = (typeof REG_ORDER !== 'undefined' ? REG_ORDER : []);
  const per = {};
  order.forEach(k => { per[k] = 0; });
  ALL.forEach(e => {
    new Set((e.registrations||[]).map(r => r.registry)).forEach(k => {
      if (k in per) per[k]++;
    });
  });
  const rows = order.map((k, i) => ({ k, c: per[k], sw: `var(--cat-${i+1})` }))
    .filter(r => r.c > 0)
    // Longest bar first, but the swatch came from vocabulary order above, so a registry
    // keeps its colour when the counts reorder it.
    .sort((a,b) => b.c - a.c || (a.k < b.k ? -1 : 1));
  if (!rows.length){
    return `<div class="qv-card${cls?' '+cls:''}"><h3 class="qv-title">Recorded elsewhere</h3>`+
      `<p class="qv-empty">No entry carries a registration at another project yet.</p></div>`;
  }

  const nameOf = k => (typeof REG_NAME !== 'undefined' && REG_NAME[k]) || k;
  const label = `Entries also recorded at another registry, out of ${n}. `+
    rows.map(r => `${nameOf(r.k)}: ${r.c}`).join('; ');
  const bars = `<div class="hbars" role="img" aria-label="${esc(label)}">` +
    rows.map(r =>
      `<div class="hbar" title="${esc(`${nameOf(r.k)}: ${r.c} of ${n} entries`)}">`+
      `<span class="hbar-label"><i class="sw" style="background:${r.sw}"></i>`+
      `${esc(nameOf(r.k))}</span>`+
      `<span class="hbar-track"><span class="hbar-fill"`+
      ` style="width:${Math.round(r.c/n*100)}%"></span></span>`+
      `<span class="hbar-val">${r.c}</span></div>`).join('') + `</div>`;

  // Both denominators, because the flat one understates the coverage and saying only the
  // flat one would read as a gap these projects had left rather than one outside their
  // scope. All four are mathematics projects.
  const none = ALL.filter(e => !(e.registrations||[]).length).length;
  const math = ALL.filter(e => e.field === 'mathematics');
  const mathNone = math.filter(e => !(e.registrations||[]).length).length;
  return `<div class="qv-card${cls?' '+cls:''}">`+
    `<div class="qv-head"><h3 class="qv-title">Recorded elsewhere</h3></div>${bars}`+
    `<p class="qv-foot">Of ${n} entries, counted once per registry. `+
    `${none} are recorded nowhere else. All four projects are mathematics projects, so most `+
    `of the ${n - math.length} entries outside mathematics are outside their scope: of the `+
    `${math.length} mathematics entries, ${mathNone} carry no registration. `+
    `<a href="/registries">What each one certifies</a>.</p></div>`;
}

// The record book: how old a problem this registry has seen fall, and when that last moved.
//
// Adapted from a running-best line rather than copied, because the record alone is six
// points on a ten-year axis and six points are not a chart. The dots are every entry that
// records a posed year; the line over them is the running maximum, which is flat by
// construction and only breaks when something older falls. Reading both at once is the
// point: the cloud says how much is happening, the line says whether any of it was
// unprecedented.
function recordCard(cls){
  const pts = ALL.map(e => ({ e, n: yearsOpen(e) })).filter(p => p.n != null)
    .sort((a,b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : 0)
                || (a.e.id < b.e.id ? -1 : 1));
  if (pts.length < 2){
    return `<div class="qv-card${cls?' '+cls:''}"><h3 class="qv-title">The record book</h3>`+
      `<p class="qv-empty">Too few entries record the year their problem was posed to draw a record.</p></div>`;
  }

  // One step per date, not per entry: three records fell on 2025-05-14, and three vertical
  // steps at one x reads as a drawing error rather than as three results.
  const records = [];
  let best = -1;
  pts.forEach((p, i) => {
    if (p.n <= best) return;
    if (records.length && records[records.length-1].e.date === p.e.date) records.pop();
    records.push({ i, n: p.n, e: p.e });
    best = p.n;
  });

  const W = 940, H = 330, PADL = 46, PADR = 18, PADT = 30, PADB = 46;
  const x0 = PADL, x1 = W - PADR, yTop = PADT, yBot = H - PADB;
  // One slot per entry in date order, not a calendar axis. Intake is far lumpier than the
  // calendar: most of these entries share a handful of recent months, and on a date axis
  // they stack into an unreadable smear against the right edge while most of the plot sits
  // empty. Equal slots give each year the width its share of the entries earns, which is
  // what the reader is being asked to compare; the year rules below keep the calendar
  // visible. Safe to divide: the early return above guarantees two points.
  const x = i => x0 + i * (x1 - x0) / (pts.length - 1);

  // Log, because the range runs from a problem posed the same year to one posed in 1637,
  // and a linear axis spends nine tenths of its height on empty space above the cloud.
  // log(v+1) rather than log(v) so a problem closed in the year it was posed sits on the
  // axis instead of at negative infinity.
  const maxN = Math.max(...pts.map(p => p.n));
  const top = maxN <= 10 ? 10 : maxN <= 100 ? Math.ceil(maxN/10)*10 : Math.ceil(maxN/100)*100;
  const lg = v => Math.log10(v + 1);
  const y = v => yBot - lg(v) / lg(top) * (yBot - yTop);
  const yticks = [0, 10, 100, top].filter((v,i,a) => v <= top && a.indexOf(v) === i);

  const grid = yticks.map(t =>
    `<line x1="${x0}" y1="${y(t).toFixed(1)}" x2="${x1}" y2="${y(t).toFixed(1)}" class="mx-guide"/>`+
    `<text x="${x0-7}" y="${(y(t)+3.5).toFixed(1)}" class="mx-tick" text-anchor="end">${t}</text>`
  ).join('');

  // A rule at every year boundary, but a label only where one fits. The early years hold
  // one entry each, so their boundaries are a dozen pixels apart and every label would
  // overprint its neighbour; the rules still show the reader where the years divide. The
  // first and last are always labelled, so the axis always states the range it covers.
  const yr0 = +pts[0].e.date.slice(0,4), yr1 = +pts[pts.length-1].e.date.slice(0,4);
  const bounds = [];
  for (let yr = yr0 + 1; yr <= yr1; yr++){
    const i = pts.findIndex(p => +p.e.date.slice(0,4) >= yr);
    if (i <= 0) continue;
    // A year with no entries at all starts at the same slot as the year after it. Keep the
    // later one: everything right of that rule is that year or newer, and labelling it with
    // the empty year would say the opposite.
    if (bounds.length && bounds[bounds.length-1].i === i) bounds[bounds.length-1].yr = yr;
    else bounds.push({ yr, i });
  }
  let last = -Infinity;
  const xticks = [{ yr: yr0, i: 0 }].concat(bounds).map((b, k, a) => {
    const px = x(b.i);
    const rule = b.i > 0
      ? `<line x1="${px.toFixed(1)}" y1="${yTop}" x2="${px.toFixed(1)}" y2="${yBot}" class="mx-guide"/>` : '';
    // Always the first and the last; anything between only if it has clear air.
    const room = k === 0 || k === a.length - 1 || (px - last >= 46 && x(a[a.length-1].i) - px >= 46);
    if (!room) return rule;
    last = px;
    return rule + `<text x="${px.toFixed(1)}" y="${yBot+16}" class="mx-tick" text-anchor="middle">${b.yr}</text>`;
  }).join('');

  const dots = pts.map((p, i) => {
    const isRec = records.some(r => r.e.id === p.e.id);
    const col = `var(${GRADE_VAR[p.e.verification]||'--muted'})`;
    return `<circle class="pt-mark${isRec?' is-rec':' is-faint'}" cx="${x(i).toFixed(1)}"`+
      ` cy="${y(p.n).toFixed(1)}" r="${isRec?5:3.4}" fill="${col}" tabindex="0" role="img"`+
      ` data-title="${esc(p.e.title)}"`+
      ` data-aut="${esc(`${p.n} years open`)}" data-autcol="${col}"`+
      ` data-open="${esc(`${p.e.date} · posed ${p.e.year_posed} · ${VER_LABEL[p.e.verification]||p.e.verification}`)}"`+
      ` aria-label="${esc(`${p.e.title}: open ${p.n} years, closed ${p.e.date}.`)}"></circle>`;
  }).join('');

  // Step, not a smoothed line: the record holds flat until it breaks, and a line that
  // sloped between records would draw years of gradual progress that did not happen.
  let d = `M ${x(records[0].i).toFixed(1)} ${y(records[0].n).toFixed(1)}`;
  for (let k = 1; k < records.length; k++){
    d += ` L ${x(records[k].i).toFixed(1)} ${y(records[k-1].n).toFixed(1)}`+
         ` L ${x(records[k].i).toFixed(1)} ${y(records[k].n).toFixed(1)}`;
  }
  d += ` L ${x1} ${y(records[records.length-1].n).toFixed(1)}`;

  // Direct labels rather than a legend: they are the whole point of the card, and a legend
  // would name colours the line does not use.
  //
  // Not every record gets one. The early records are a handful of entries apart, so all
  // four labels printed on top of each other in the left corner. Biggest jump first, then
  // greedily, skipping any that would land within LAB_GAP of one already placed: the jump
  // is what makes a record worth naming, and the ones dropped are still drawn as a ringed
  // dot and named in full by the tooltip. Ranked by jump rather than by date so which
  // labels survive does not depend on how many entries happen to sit between them. The
  // first record jumps from nothing, so it competes on its own span: it set the bar.
  const LAB_GAP = 90;
  const placed = [];
  records.map((r, k) => ({ r, jump: r.n - (k ? records[k-1].n : 0) }))
    .sort((a,b) => b.jump - a.jump || a.r.i - b.r.i)
    .forEach(({ r }) => {
      if (placed.every(q => Math.abs(x(q.i) - x(r.i)) >= LAB_GAP)) placed.push(r);
    });
  placed.sort((a,b) => a.i - b.i);

  // Sides alternate, so any pair the gap above still lets through is separated by a whole
  // line without this having to measure text it has no way to measure. A label near the
  // right edge is anchored to its end so it cannot run off.
  const labs = placed.map((r, i) => {
    const px = x(r.i), end = px > x1 - 150, above = i % 2 === 0;
    const t = r.e.title.length > 30 ? r.e.title.slice(0,29).trimEnd() + '…' : r.e.title;
    return `<text class="rc-lab" x="${(px + (end ? -8 : 8)).toFixed(1)}"`+
      ` y="${(y(r.n) + (above ? -9 : 16)).toFixed(1)}"`+
      ` text-anchor="${end?'end':'start'}">${esc(`${r.n} yr · ${t}`)}</text>`;
  }).join('');

  const held = records[records.length-1];
  return `<div class="qv-card${cls?' '+cls:''}">`+
    `<div class="qv-head"><h3 class="qv-title">The record book</h3></div>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img"`+
    ` aria-label="${esc(`Years each problem had stood when it fell, for ${pts.length} entries, `+
      `with the running record over them. The record has moved ${records.length} times, and stands at `+
      `${held.n} years: ${held.e.title}.`)}"`+
    ` preserveAspectRatio="xMidYMid meet">`+
    grid + xticks +
    `<path class="rc-line" d="${d}"/>` + dots + labs +
    `<text x="${(x0-34).toFixed(1)}" y="${((yTop+yBot)/2).toFixed(1)}" class="sc-axis"`+
    ` text-anchor="middle" transform="rotate(-90 ${(x0-34).toFixed(1)} ${((yTop+yBot)/2).toFixed(1)})">Years open</text>`+
    `</svg><div class="sc-tip" hidden aria-hidden="true"></div></div>`+
    `<p class="qv-foot">One dot per entry, coloured by grade; the line is the record. `+
    `It has moved ${records.length} times and stands at ${held.n} years. `+
    `Drawn from the ${pts.length} of ${ALL.length} entries recording a posed year. `+
    `One slot per entry in date order rather than a calendar axis, because most of them are `+
    `dated ${yr1} and a calendar would stack them against the right edge; the rules mark the `+
    `year boundaries. Years open is logarithmic.</p></div>`;
}

// Interactive tooltip for the plots: shows on hover/focus of a mark, positioned inside
// its own chart wrapper. Delegated + re-bindable so it survives chart re-renders, and
// bound per wrapper so each plot's tooltip stays inside that plot's card.
//
// The rows are driven by which data attributes a mark carries rather than by which chart
// it belongs to. Only the evidence/autonomy matrix uses this now, but the `.sc-*` naming
// is the shared plot chrome rather than anything scatter-specific, and a second plot
// would need no changes here beyond setting its own data attributes.
function wireScatterTip(){
  document.querySelectorAll('.sc-wrap').forEach(wrap => {
    const tip = wrap.querySelector('.sc-tip');
    if (!tip) return;
    wireOnePlotTip(wrap, tip);
  });
}

function wireOnePlotTip(wrap, tip){
  const show = dot => {
    const d = dot.dataset;
    tip.innerHTML =
      `<span class="sc-tip-t">${esc(d.title)}</span>`+
      `<span class="sc-tip-r"><i class="sw" style="background:${d.autcol}"></i>${esc(d.aut)}</span>`+
      (d.open ? `<span class="sc-tip-m">${esc(d.open)}</span>` : '');
    tip.hidden = false;
    tip.setAttribute('aria-hidden', 'false');
    // Position: SVG scales to the wrapper, so map the dot's viewBox coords to px.
    const svg = wrap.querySelector('.sc');
    const wr = wrap.getBoundingClientRect(), dr = dot.getBoundingClientRect();
    const cx = dr.left + dr.width/2 - wr.left, cy = dr.top - wr.top;
    // Measure, then clamp within the wrapper so it never overflows the card.
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = cx - tw/2;
    left = Math.max(4, Math.min(left, wr.width - tw - 4));
    let top = cy - th - 12;
    if (top < 2) top = dr.bottom - wr.top + 12; // flip below if no room above
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };
  const hide = () => { tip.hidden = true; tip.setAttribute('aria-hidden', 'true'); };

  const MARK = '.mx-dot,.pt-mark';
  wrap.addEventListener('pointerover', e => { const d = e.target.closest(MARK); if (d) show(d); });
  wrap.addEventListener('pointerout', e => { if (e.target.closest(MARK)) hide(); });
  wrap.addEventListener('focusin', e => { const d = e.target.closest(MARK); if (d) show(d); });
  wrap.addEventListener('focusout', e => { if (e.target.closest(MARK)) hide(); });
}

// View toggles and legend keys. Both re-encode the whole registry rather than filtering it:
// a toggle swaps how the same 77 entries are drawn, and a legend key dims the other series
// without removing them, so the page keeps the promise its lede makes.
function wireChartControls(){
  document.querySelectorAll('.qv-card[data-view]').forEach(card => {
    const btns = [...card.querySelectorAll('.qv-seg button')];
    btns.forEach(b => b.addEventListener('click', () => {
      card.dataset.view = b.dataset.view;
      btns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    }));
  });
  document.querySelectorAll('.qv-legend').forEach(leg => {
    const card = leg.closest('.qv-card');
    if (!card) return;
    const keys = [...leg.querySelectorAll('.qv-key')];
    keys.forEach(b => b.addEventListener('click', () => {
      // Clicking the active key clears the highlight, so the control is its own escape.
      const active = b.getAttribute('aria-pressed') === 'true';
      keys.forEach(o => o.setAttribute('aria-pressed', String(!active && o === b)));
      card.querySelectorAll('.ser').forEach(g =>
        g.classList.toggle('is-dim', !active && g.dataset.ser !== b.dataset.ser));
    }));
  });
}

// ---------- View state ----------
// Every view of the registry is a URL. The search box, the four filters and the sort
// order all live in the query string, so a filtered view can be linked, bookmarked and
// stepped back through with the browser's own back button. index.html's SearchAction
// JSON-LD has advertised /?q=… since the site launched; reading it here is what makes
// that claim true rather than aspirational.
const PARAMS = ['q', 'field', 'lab', 'ver', 'aut', 'tag', 'since', 'sort', 'view'];
const DEFAULTS = { q:'', field:'', lab:'', ver:'', aut:'', tag:'', since:'', sort:'date-desc', view:'table' };
// The filters proper: the ones that narrow the list, as opposed to reordering it. The
// chips, the empty state and the pristine test all work from this, not from PARAMS.
const FILTERS = ['q', 'field', 'lab', 'ver', 'aut', 'tag', 'since'];
const FILTER_NAME = { q:'Search', field:'Field', lab:'Lab', ver:'Verification',
                      aut:'Autonomy', tag:'Tag', since:'Added' };

// The time window, stored as a token rather than as a resolved date.
//
// ?since=7d means "the last week from whenever you open this", so a link posted today
// still means the same thing next month. A resolved date in the URL would freeze, and a
// date computed at build time would rot: this script's Python counterpart imports no
// clock at all, for exactly that reason. The browser has a real clock, so the token is
// resolved at render time, on this side only.
//
// Filters on `added`, when the entry reached this registry, not on `date`, when the
// result became public. "What is new here" is the question the control answers, and the
// two differ by years on the older entries.
const SINCE_DAYS = { '24h': 1, '3d': 3, '7d': 7, '30d': 30, '90d': 90 };
const SINCE_LABEL = { '24h':'Last 24 hours', '3d':'Last 3 days', '7d':'Last 7 days',
                      '30d':'Last 30 days', '90d':'Last 90 days' };
const STATE = { ...DEFAULTS };

// Sort orders. VER_SCORE and AUT_RANK are the registry's own rankings, already driving
// the hero matrix and the pills, so sorting reuses them rather than inventing a second
// scale that could disagree with the chart. Date breaks every tie, so the order is
// total and a re-sort never reshuffles equal entries.
const SORTS = {
  'relevance': (a, b) => score(b, STATE.q) - score(a, STATE.q) || b.date.localeCompare(a.date),
  'date-desc': (a, b) => b.date.localeCompare(a.date),
  'date-asc':  (a, b) => a.date.localeCompare(b.date),
  'evidence':  (a, b) => (VER_SCORE[b.verification] ?? 0) - (VER_SCORE[a.verification] ?? 0)
                         || b.date.localeCompare(a.date),
  'autonomy':  (a, b) => (AUT_RANK[b.autonomy] ?? 0) - (AUT_RANK[a.autonomy] ?? 0)
                         || b.date.localeCompare(a.date),
  'title':     (a, b) => a.title.localeCompare(b.title),
  'lab':       (a, b) => a.lab.localeCompare(b.lab) || b.date.localeCompare(a.date)
};

// ---------- Search ----------
// Searching JSON.stringify(entry) matched keys, URLs and slugs as well as prose, so
// "claim", "com" and "http" each matched every entry and the box appeared to do
// nothing. This searches named fields only. Built once per entry and cached: the
// haystack is the same for every keystroke, and only the needle changes.
const HAY = new Map();
function haystack(e){
  let h = HAY.get(e.id);
  if (h === undefined){
    h = [e.title, e.claim, e.detail, e.lab, e.model, e.field, e.id, e.novelty_check,
         e.caveats, (e.humans || []).join(' '), (e.tags || []).join(' ')]
        .filter(Boolean).join(' ').toLowerCase();
    HAY.set(e.id, h);
  }
  return h;
}

// Where a term hits matters: a title match is what you meant, a caveats match usually
// is not. Used only by the relevance sort, so an explicit sort still wins.
function score(e, q){
  if (!q) return 0;
  const n = q.toLowerCase();
  const has = s => (s || '').toLowerCase().includes(n);
  return (has(e.title) ? 8 : 0)
       + (has(e.claim) || has(e.detail) ? 4 : 0)
       + (has((e.tags || []).join(' ')) ? 2 : 0)
       + (has(e.lab) || has(e.model) || has((e.humans || []).join(' ')) ? 1 : 0);
}

// Table or cards. The table is the default: a registry is for scanning, and a page of
// tall cards is one long scroll. A preference rather than a property of the link, so it
// is remembered the way the theme is, and a URL without ?view= opens the way this visitor
// last left it. An explicit ?view= in a link still wins for that visit.
// Nothing stored is NOT the same answer as "table" stored, which is why this no longer
// collapses both to 'table'. With no preference the viewport decides: .regtable is
// min-width:1040px, so on a phone the table view opens as a sideways scroll of a page
// that is supposed to be read. The viewport answer is a default and never a preference,
// so it is not written back: only the view toggle writes localStorage (see the click
// handler below), and one link opened on a phone must not put a desktop into cards.
//
// The pre-paint script in index.html resolves this identically, so the layout is already
// correct before this file runs. Change one, change both.
function storedView(){
  try {
    const v = localStorage.getItem('view');
    if (v === 'cards' || v === 'table') return v;
  } catch (e){}
  try { return matchMedia('(max-width: 720px)').matches ? 'cards' : 'table'; }
  catch (e){ return 'table'; }
}

function readState(){
  const p = new URLSearchParams(location.search);
  for (const k of PARAMS) STATE[k] = p.get(k) ?? DEFAULTS[k];
  // Only an exact cards|table counts as the link asking for a layout. A present but
  // malformed ?view= falls through to the preference and then the viewport, which is
  // what the pre-paint script in index.html does: it matches view=(cards|table) or
  // nothing at all. Treating a bad value as "table" here instead would put a phone into
  // the 1040px table off a mistyped URL, and would disagree with the markup already painted.
  const qv = p.get('view');
  if (qv !== 'cards' && qv !== 'table') STATE.view = storedView();
  // A hand-edited or truncated URL should degrade to the default rather than render an
  // empty list the visitor has no way to explain. Same for the window: an unrecognised
  // token would otherwise show a chip reading "Added: 8d" that filtered nothing, which
  // is worse than ignoring it.
  if (!SORTS[STATE.sort]) STATE.sort = DEFAULTS.sort;
  if (STATE.since && !SINCE_DAYS[STATE.since]) STATE.since = DEFAULTS.since;
  if (STATE.view !== 'cards') STATE.view = 'table';
}

function writeState(mode){
  const p = new URLSearchParams();
  for (const k of PARAMS) if (STATE[k] !== DEFAULTS[k]) p.set(k, STATE[k]);
  const qs = p.toString();
  const url = location.pathname + (qs ? '?' + qs : '') + location.hash;
  if (url === location.pathname + location.search + location.hash) return;
  // Typing replaces, so one keystroke is not one history entry. A discrete choice
  // pushes, so back and forward step through decisions the visitor actually made.
  history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

// Whether the pre-rendered markup is still correct. `view` is excluded on purpose:
// build-site.py writes *both* layouts into #list and CSS shows one, so either view is
// already right on the page. Only a filter or a non-default sort makes it wrong.
function pristine(){
  return PARAMS.every(k => k === 'view' || STATE[k] === DEFAULTS[k]);
}
function activeFilters(){ return FILTERS.filter(k => STATE[k] !== DEFAULTS[k]); }

// The window token as an ISO date, or '' for no window. Both `added` and this are
// YYYY-MM-DD, so the comparison in matches() is a string compare.
//
// Read the clock once per call and not once per entry: matches() runs over every entry
// on every keystroke, and a date rebuilt inside that loop would be both wasted work and,
// across a midnight boundary, capable of disagreeing with itself mid-render.
//
// Built from the local date parts rather than toISOString(), which is UTC. setDate()
// steps in local time, so mixing the two shifts the boundary by a day for anyone far
// enough west: at UTC-11 the "last 24 hours" cutoff came out as today's date, and the
// entries added today were filtered out of the window meant to show them.
function sinceCutoff(token){
  const days = SINCE_DAYS[token];
  if (!days) return '';
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Written as a function of (entry, state) rather than of the DOM, so the empty state can
// re-run it with a single filter lifted to work out which one to suggest dropping.
//
// `cutoff` is passed in rather than derived from `s`, so the one clock read per render
// is shared by every entry and the function stays pure.
function matches(e, s, cutoff = sinceCutoff(s.since)){
  return (!s.field || e.field === s.field)
      && (!s.lab   || e.lab === s.lab)
      && (!s.ver   || e.verification === s.ver)
      && (!s.aut   || e.autonomy === s.aut)
      && (!s.tag   || (e.tags || []).includes(s.tag))
      && (!cutoff  || (e.added || '') >= cutoff)
      && (!s.q     || haystack(e).includes(s.q.toLowerCase()));
}

// Highlighting runs over the rendered DOM rather than inside card(), on purpose.
// card() is one half of a parity pair diffed byte for byte against build-site.py, which
// has no query to highlight, so marking matches in the template would put the two
// renderers permanently out of step. Text nodes only, for the same reason: re-parsing
// innerHTML here could alter the exact markup card() produced.
function highlight(root, q){
  const needle = (q || '').toLowerCase();
  if (!needle) return;
  for (const el of root.querySelectorAll('.entry h2 .entry-link, .entry .claim, .entry .detail')){
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const n of nodes){
      const hay = n.data.toLowerCase();
      if (!hay.includes(needle)) continue;
      const frag = document.createDocumentFragment();
      let pos = 0, i = hay.indexOf(needle);
      while (i >= 0){
        if (i > pos) frag.append(n.data.slice(pos, i));
        const mark = document.createElement('mark');
        mark.textContent = n.data.slice(i, i + needle.length);
        frag.append(mark);
        pos = i + needle.length;
        i = hay.indexOf(needle, pos);
      }
      if (pos < n.data.length) frag.append(n.data.slice(pos));
      n.replaceWith(frag);
    }
  }
}

function selected(){
  const cutoff = sinceCutoff(STATE.since);
  return ALL.filter(e => matches(e, STATE, cutoff)).sort(SORTS[STATE.sort]);
}

function filterValue(k, v){
  if (k === 'ver') return VER_LABEL[v] || v;
  if (k === 'aut') return AUT_LABEL[v] || v;
  if (k === 'since') return SINCE_LABEL[v] || v;
  return v;
}

function renderChips(){
  const box = document.getElementById('chips');
  if (!box) return;
  const active = activeFilters();
  // Emptied, not just hidden: the toolbar is sticky, so a chip row left in the DOM
  // would keep taking height off every screen even when nothing is filtered.
  box.hidden = !active.length;
  box.innerHTML = !active.length ? '' : active.map(k => {
    const v = filterValue(k, STATE[k]);
    return `<button type="button" class="chip" data-clear="${k}"
      aria-label="Remove ${FILTER_NAME[k]} filter: ${esc(v)}"><span class="chip-k">${FILTER_NAME[k]}</span
      ><span class="chip-v">${esc(v)}</span><span class="chip-x" aria-hidden="true">×</span></button>`;
  }).join('') + '<button type="button" class="chip chip-all" data-clear="*">Clear all</button>';
}

function emptyState(){
  const active = activeFilters();
  // Which single filter is doing the damage? Re-run the match with each one lifted and
  // name the one that brings the most back, so the way out is one click rather than a
  // guessing game against six controls.
  let best = null, bestN = 0;
  for (const k of active){
    const n = ALL.filter(e => matches(e, { ...STATE, [k]: DEFAULTS[k] })).length;
    if (n > bestN){ bestN = n; best = k; }
  }
  const hint = best ? `<p>Dropping the ${FILTER_NAME[best].toLowerCase()} filter
    (<b>${esc(filterValue(best, STATE[best]))}</b>) brings back ${bestN}
    ${bestN === 1 ? 'entry' : 'entries'}.</p>
    <button type="button" class="empty-act" data-clear="${best}">Drop that filter</button>` : '';
  return `<div class="empty"><p>No entries match
    ${active.length === 1 ? 'that filter' : `all ${active.length} filters`}.</p>${hint}
    <button type="button" class="empty-act empty-all" data-clear="*">Clear all filters</button></div>`;
}

// ---------- Table view ----------
// 52 tall cards is one long scroll, and a registry exists to be scanned. The table puts
// every entry on one screen and keeps the same pills, so the two views read as the same
// data rather than two designs. Client-side only: the cards stay the pre-rendered
// default, so crawlers and a no-JS visitor are unaffected and parity has nothing new to
// guard. Model and Field are display-only; the sortable columns are the ones the
// registry actually ranks by.
const COLS = [
  { label:'Date',         sort:'date-desc', alt:'date-asc' },
  { label:'Finding',      sort:'title' },
  { label:'Lab',          sort:'lab' },
  { label:'Model' },
  { label:'Verification', sort:'evidence' },
  { label:'Autonomy',     sort:'autonomy' },
  { label:'Field' }
];

function tableView(out){
  const head = COLS.map(c => {
    if (!c.sort) return `<th scope="col">${c.label}</th>`;
    const active = STATE.sort === c.sort || (c.alt && STATE.sort === c.alt);
    // Only Date reverses, because only Date has an obvious opposite reading.
    const next = (c.alt && STATE.sort === c.sort) ? c.alt : c.sort;
    const dir = !active ? 'none' : (STATE.sort === 'date-asc' ? 'ascending' : 'descending');
    return `<th scope="col" aria-sort="${dir}"><button type="button" class="th-sort${
      active ? ' on' : ''}" data-sort="${next}">${c.label}</button></th>`;
  }).join('');
  // title attributes because Lab, Model and Field clip with an ellipsis: the full value
  // has to stay reachable without leaving the table.
  const rows = out.map(e => `<tr>
      <td class="t-date">${esc(e.date)}</td>
      <td class="t-title"><a href="/finding/${esc(e.id)}">${esc(e.title)}</a></td>
      <td title="${esc(e.lab)}">${esc(e.lab)}</td>
      <td title="${esc(e.model)}">${esc(e.model)}</td>
      <td><span class="pill v v-${esc(e.verification)}">${esc(VER_LABEL[e.verification]||e.verification)}</span></td>
      <td><span class="pill a a-${esc(e.autonomy)}">${esc(AUT_LABEL[e.autonomy]||e.autonomy)}</span></td>
      <td title="${esc(e.field)}">${esc(e.field)}</td>
    </tr>`).join('');
  const cols = ['date','title','lab','model','ver','aut','field']
    .map(c => `<col class="c-${c}">`).join('');
  return `<div class="tablewrap"><table class="regtable">
    <caption class="vh">All findings in the registry, sortable by column.</caption>
    <colgroup>${cols}</colgroup>
    <thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- CSV export ----------
// The whole registry has always been downloadable as one JSON file. This exports the
// view actually on screen, filters and sort included, which is what someone reading a
// filtered slice wants to take away. Built in the browser: nothing is uploaded, and
// there is no endpoint to add.
const CSV_COLS = [
  ['id', e => e.id], ['date', e => e.date], ['title', e => e.title],
  ['claim', e => e.claim], ['field', e => e.field], ['lab', e => e.lab],
  ['model', e => e.model],
  ['verification', e => VER_LABEL[e.verification] || e.verification],
  ['autonomy', e => AUT_LABEL[e.autonomy] || e.autonomy],
  ['humans', e => (e.humans || []).join('; ')],
  ['tags', e => (e.tags || []).join('; ')],
  ['url', e => location.origin + '/finding/' + e.id],
  ['sources', e => (e.sources || []).map(s => `${SRC_LABEL[s.kind] || s.kind}: ${s.url}`).join(' | ')]
];

function csv(rows){
  // RFC 4180 quoting throughout. A leading =, +, - or @ is prefixed with a quote as
  // well: spreadsheets treat those as formulas, and a registry field should never
  // execute in someone's spreadsheet.
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [CSV_COLS.map(c => cell(c[0])).join(',')]
    .concat(rows.map(e => CSV_COLS.map(c => cell(c[1](e))).join(',')))
    .join('\r\n');
}

function exportCsv(){
  const rows = selected();
  const blob = new Blob(['﻿' + csv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const bits = activeFilters().map(k => `${k}-${STATE[k]}`.replace(/[^a-z0-9-]+/gi, '-'));
  a.download = ['whataifound', ...bits].join('_').slice(0, 120) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next frame rather than immediately: Safari has not always finished
  // reading the blob by the time click() returns.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

function render(){
  // Before the registry has loaded there is nothing to render *from*, and the markup
  // already on the page is correct for the unfiltered view. Rewriting it from an empty
  // ALL would blank the list. bootData() calls render() again the moment data lands, so
  // whatever the visitor asked for in the meantime is applied then.
  if (!ALL.length) return;
  const out = selected();
  const list = document.getElementById('list');
  // build-site.py has already written these exact cards into index.html, newest first
  // with nothing filtered. Rewriting identical markup on load would throw away the
  // parsed DOM (and any <details> the browser restored on a back-navigation) for no
  // visual change, so the first paint adopts the server markup as-is. That is only
  // correct for the pristine view: a URL carrying a filter or a sort asked for
  // something the pre-render is not, and must render before it is seen.
  const adopt = list.hasAttribute('data-prerendered') && pristine();
  list.removeAttribute('data-prerendered');
  const table = STATE.view === 'table';
  list.classList.toggle('as-table', table);
  if (!adopt){
    if (!out.length) list.innerHTML = emptyState();
    else if (table) list.innerHTML = tableView(out);
    else { list.innerHTML = out.map(card).join(''); highlight(list, STATE.q); }
  }
  document.getElementById('count').textContent =
    `${out.length} / ${ALL.length} ${out.length===1?'entry':'entries'}`;
  const csvBtn = document.getElementById('csv');
  if (csvBtn){
    csvBtn.textContent = out.length === ALL.length
      ? `Export all ${ALL.length} entries as CSV`
      : `Export these ${out.length} ${out.length===1?'entry':'entries'} as CSV`;
    csvBtn.disabled = !out.length;
  }
  // Stagger only on the first paint so filtering stays instant. The table is one child,
  // so there is nothing to stagger there.
  if (first && !REDUCE && !table){
    list.classList.add('animate');
    [...list.children].forEach((el,i)=> el.style.setProperty('--d', Math.min(i*45,520)+'ms'));
  } else {
    list.classList.remove('animate');
  }
  first = false;
}

// The single entry point for a state change: URL, controls, chips and list, in that
// order. Anything that mutates STATE calls this rather than re-rendering by hand, so
// the four can never disagree.
function update(mode){
  // Touching any control is the signal that this visitor wants filtering, so the
  // deferred fetch starts here if it has not already. The URL, the controls and the
  // chips all update at once regardless; only the list waits for the data.
  ensureData();
  writeState(mode);
  syncControls();
  renderChips();
  render();
}

function syncControls(){
  for (const id of ['q', 'field', 'lab', 'ver', 'aut', 'since', 'sort']){
    const el = document.getElementById(id);
    if (el && el.value !== STATE[id]) el.value = STATE[id];
  }
  document.querySelectorAll('.view-seg .vw').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.view === STATE.view ? 'true' : 'false'));
  // The same attribute the pre-paint script sets. While the pre-rendered markup is still
  // in place this is what actually swaps the two layouts, so switching view is instant
  // and works before the registry JSON has loaded.
  document.documentElement.setAttribute('data-view', STATE.view);
}

// Chips and the empty state both clear filters, and the empty state lives inside #list,
// so the handler is shared rather than written twice.
function onClear(ev){
  const btn = ev.target.closest('[data-clear]');
  if (!btn) return;
  const k = btn.dataset.clear;
  if (k === '*') FILTERS.forEach(f => { STATE[f] = DEFAULTS[f]; });
  else STATE[k] = DEFAULTS[k];
  update('push');
  return true;
}

function countUp(el, target){
  if (REDUCE){ el.textContent = target; return; }
  const dur = 620, t0 = performance.now();
  (function step(now){
    const p = Math.min((now-t0)/dur, 1);
    el.textContent = Math.round((1-Math.pow(1-p,3)) * target);
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

// Runs when the registry JSON has landed. Everything here genuinely needs the data:
// the charts, the derived stats, the filter option lists and the first real render.
function bootData(data){
  ALL = data.sort((a,b)=> b.date.localeCompare(a.date));

  // Charts render wherever a #charts container exists: the registry page and the
  // standalone visuals page both mount it. Everything below is registry-only and is
  // skipped (via the #list guard) when app.js runs on visuals.html.
  renderCharts();

  // The homepage hero has no #charts grid: its matrix is pre-rendered into the markup by
  // build-site.py, so renderCharts() returned before reaching wireScatterTip(). Wire the
  // plots already in the DOM instead. Guarded so the visuals page doesn't wire twice.
  if (!document.getElementById('charts')) wireScatterTip();

  if (!document.getElementById('list')) return;  // visuals-only page: done here.

  const strong = ALL.filter(e=>['formal','independent','peer-reviewed'].includes(e.verification)).length;
  const auto = ALL.filter(e=>['autonomous','ai-led'].includes(e.autonomy)).length;
  const negative = ALL.filter(e=>['known','disputed','refuted'].includes(e.verification)).length;
  const stats = [
    [ALL.length,'Entries on record'], [strong,'Well verified'],
    [auto,'AI-led or autonomous'], [negative,'Negative or contested']
  ];
  const statsEl = document.getElementById('stats');
  if (statsEl){
    // build-site.py writes these already filled in, so a crawler reads the real
    // figures. Rewriting them to 0 to run the count-up would be a visible flicker
    // backwards, so the animation only runs when the markup wasn't pre-rendered.
    const prerendered = !!statsEl.querySelector('.stat');
    if (!prerendered){
      statsEl.innerHTML =
        stats.map(([n,l])=>`<div class="stat"><b data-target="${n}">0</b><span>${l}</span></div>`).join('');
      document.querySelectorAll('#stats .stat b').forEach(el=> countUp(el, +el.dataset.target));
    }
  }

  const fill = (id, vals, labels) => {
    const s = document.getElementById(id);
    // build-site.py pre-renders these options so a crawler sees the facets and a
    // no-JS visitor doesn't get empty dropdowns. Appending on top of that would list
    // every option twice, so drop all but the leading "All …" placeholder first.
    while (s.options.length > 1) s.remove(1);
    [...new Set(vals)].sort().forEach(v => s.insertAdjacentHTML('beforeend',
      `<option value="${esc(v)}">${esc(labels?labels[v]||v:v)}</option>`));
  };
  fill('field', ALL.map(e=>e.field));
  fill('lab', ALL.map(e=>e.lab));
  fill('ver', ALL.map(e=>e.verification), VER_LABEL);
  fill('aut', ALL.map(e=>e.autonomy), AUT_LABEL);


  // The selects were just rebuilt, which drops any value set before the data arrived,
  // so the controls are re-synced and the list rendered for whatever state is current.
  syncControls();
  renderChips();
  render();
}

// Runs immediately, with no data. index.html already contains all 52 cards, the filter
// options and the counts, pre-rendered by build-site.py, so the page is readable and
// most of it is interactive before a single byte of JSON has been fetched.
function bootStatic(){
  // The citation year moved to chrome.js, which runs on every page; the footer it
  // stamps is now on every page too.
  // visuals.html has no list to filter: its charts are the whole page, so it needs the
  // registry straight away and none of the wiring below.
  if (!document.getElementById('list')){ ensureData(); return; }

  readState();
  syncControls();
  renderChips();
  // Typing replaces the history entry; choosing from a dropdown pushes one. See
  // writeState() for why the two differ.
  document.getElementById('q').addEventListener('input', ev => {
    const had = !!STATE.q;
    STATE.q = ev.target.value;
    // Typing switches to best-match ordering and clearing the box switches back, unless
    // a sort was chosen deliberately in between, which is then left alone.
    if (STATE.q && !had && STATE.sort === 'date-desc') STATE.sort = 'relevance';
    if (!STATE.q && STATE.sort === 'relevance') STATE.sort = DEFAULTS.sort;
    update('replace');
  });
  ['field','lab','ver','aut','since','sort'].forEach(id =>
    document.getElementById(id).addEventListener('change', ev => {
      STATE[id] = ev.target.value; update('push');
    }));
  document.getElementById('chips').addEventListener('click', onClear);
  // Export needs the rows themselves, so unlike the filters it cannot act before the
  // data is in hand.
  document.getElementById('csv')?.addEventListener('click',
    () => ensureData().then(exportCsv));
  // The counterpart to export: the view itself rather than its rows. Needs no data, so
  // unlike export it works before the registry has loaded.
  document.getElementById('share')?.addEventListener('click', ev => {
    const btn = ev.currentTarget;
    // search, not hash: the hash names one entry, and this shares the view. Composed
    // from location rather than writeState() so it is whatever the address bar says.
    const url = location.origin + location.pathname + location.search;
    const say = text => {
      const was = btn.dataset.was || btn.textContent;
      btn.dataset.was = was;
      btn.textContent = text;
      setTimeout(() => { btn.textContent = was; }, 1400);
    };
    const copy = () => window.wafCopy
      ? window.wafCopy(url, null, () => say('Link copied'), () => say('Copy failed'))
      : say('Copy failed');
    // The share sheet is the better affordance on a phone and the wrong one on a desktop,
    // where it opens an OS panel in front of someone who asked for a copy. Dismissing the
    // sheet is a decision, not a failure, so AbortError falls through to nothing.
    let coarse = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e){}
    if (navigator.share && coarse){
      navigator.share({ title: document.title, url })
        .catch(err => { if (err && err.name !== 'AbortError') copy(); });
      return;
    }
    copy();
  });
  document.querySelector('.view-seg')?.addEventListener('click', ev => {
    const b = ev.target.closest('.vw');
    if (!b) return;
    STATE.view = b.dataset.view;
    try { localStorage.setItem('view', STATE.view); } catch (e){}
    update('push');
  });
  // Back and forward restore a view without writing to history again.
  addEventListener('popstate', () => {
    // A fragment navigation fires popstate as well as hashchange. Nothing that affects
    // the list has changed there, and re-rendering would destroy the pre-rendered markup
    // revealFromHash is about to look in, so compare before acting.
    const p = new URLSearchParams(location.search);
    if (PARAMS.every(k => (p.get(k) ?? DEFAULTS[k]) === STATE[k])) return;
    ensureData(); readState(); syncControls(); renderChips(); render();
  });

  // ---------- Keyboard ----------
  const keys = document.getElementById('keys');
  const cmdk = document.getElementById('cmdk');
  const openPalette = wirePalette();
  document.getElementById('keys-close')?.addEventListener('click', () => keys.close());
  // The visible way in, for anyone who has not memorised the keys or has no keyboard to
  // press them with. Same two dialogs, opened the same way.
  document.querySelectorAll('.keycap').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.opens === 'cmdk'){ if (openPalette && !cmdk?.open) openPalette(); }
    else if (!keys?.open) keys?.showModal();
  }));
  addEventListener('keydown', ev => {
    // Above the modifier guard below, and the only thing allowed up here: Cmd/Ctrl+K is
    // the shortcut people try first, and the guard exists to stop "/" and "?" firing on
    // browser chords. preventDefault matters, Ctrl+K being a browser binding of its own.
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && !ev.shiftKey && (ev.key === 'k' || ev.key === 'K')){
      ev.preventDefault();
      if (openPalette && !cmdk?.open) openPalette();
      return;
    }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const el = document.activeElement;
    const typing = el && (['INPUT','SELECT','TEXTAREA'].includes(el.tagName) || el.isContentEditable);
    if (ev.key === 'Escape'){
      // <dialog> closes itself on Escape, so only the search box needs handling here.
      // Both dialogs have to be named: the palette's input is a typing context, so
      // without cmdk the Escape that closes it would also clear the search behind it.
      if (keys?.open || cmdk?.open || !typing) return;
      if (STATE.q){
        STATE.q = '';
        if (STATE.sort === 'relevance') STATE.sort = DEFAULTS.sort;
        update('push');
      }
      el.blur();
      return;
    }
    if (typing) return;
    if (ev.key === '/'){ ev.preventDefault(); document.getElementById('q').focus(); }
    else if (ev.key === '?'){ ev.preventDefault(); keys?.showModal(); }
    else if (ev.key === 'k'){ ev.preventDefault(); if (openPalette && !cmdk?.open) openPalette(); }
    // v and t drive the two segmented controls by clicking them rather than reproducing
    // what they do. The view toggle owns one localStorage write and the theme switcher
    // lives in chrome.js with its own transition and theme-color tint; a second
    // implementation of either is a second thing to keep in step.
    else if (ev.key === 'v'){
      ev.preventDefault();
      const other = document.querySelector(`.view-seg .vw[data-view="${STATE.view === 'table' ? 'cards' : 'table'}"]`);
      other?.click();
    }
    else if (ev.key === 't'){
      ev.preventDefault();
      const modes = ['light','system','dark'];
      const btns = [...document.querySelectorAll('.theme-seg .th')];
      const at = btns.findIndex(b => b.getAttribute('aria-pressed') === 'true');
      // The pressed state is the rendered truth, so reading it needs no access to the
      // stored value. Nothing pressed (a page without the control) is a no-op.
      if (at < 0) return;
      const next = modes[(modes.indexOf(btns[at].dataset.mode) + 1) % modes.length];
      document.querySelector(`.theme-seg .th[data-mode="${next}"]`)?.click();
    }
  });

  // ---------- Back to top ----------
  // The list runs to roughly 8000px and the sitemap rail is hidden below 1280px, so on
  // most screens there was no way back up but scrolling.
  const totop = document.getElementById('totop');
  if (totop){
    let pending = false;
    const sync = () => { pending = false; totop.hidden = scrollY < 1200; };
    addEventListener('scroll', () => {
      if (!pending){ pending = true; requestAnimationFrame(sync); }
    }, { passive: true });
    totop.addEventListener('click', () =>
      scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }));
    sync();
  }

  document.getElementById('list').addEventListener('click', ev => {
    if (onClear(ev)) return;
    const th = ev.target.closest('.th-sort');
    if (th){ STATE.sort = th.dataset.sort; update('push'); return; }
    const tag = ev.target.closest('.tag-chip');
    if (tag){
      // The href is a real /?tag=… URL, so a tag still works with JavaScript off and
      // reads as a link to a crawler. Intercepted here only to save the page load.
      ev.preventDefault();
      STATE.tag = new URL(tag.href).searchParams.get('tag') || '';
      update('push');
      scrollTo({ top: document.getElementById('panel-registry').offsetTop - 8,
                 behavior: REDUCE ? 'auto' : 'smooth' });
      return;
    }
    const link = ev.target.closest('.permalink');
    if (link) {
      ev.preventDefault();
      const id = link.dataset.permalink;
      const url = location.origin + location.pathname + '#' + id;
      const flash = cls => {
        link.classList.add(cls);
        setTimeout(() => link.classList.remove(cls), 1400);
      };
      // The address bar is updated either way, so when the clipboard is unavailable the
      // link is still one keystroke away and the tooltip says where it is. This used to
      // report "Link copied" on both branches, including the one that copied nothing.
      // There is no element holding this URL to select: it is composed, not rendered.
      const copy = window.wafCopy;
      if (copy) copy(url, null, () => flash('copied'), () => flash('selected'));
      else flash('selected');
      history.replaceState(null, '', '#' + id);
    }
    // The .vid-play facade swap used to live here. It moved to chrome.js when finding
    // pages started carrying videos too: chrome.js is the only script on every page, and
    // a second copy of it here is a second copy to keep in step.
  });
  render();

  // Deep link: reveal and scroll to the entry named in the URL. The list is
  // rendered client-side, so the browser's native anchor jump has already missed
  // it by the time entries exist. Also handle hashchange, so a permalink opened
  // while the page is already loaded (or back/forward between entries) still works.
  const revealFromHash = () => {
    if (!/^#e-/.test(location.hash)) return;
    let target = document.getElementById(location.hash.slice(1));
    // A permalink points at a card. In the table view that card is either hidden (both
    // layouts are pre-rendered) or absent entirely (the list has been re-rendered as a
    // table), so following the link would silently do nothing. Switch this visit to
    // cards and look again. The URL records it so the view and the address bar agree;
    // the *stored* preference is deliberately left alone, because following someone
    // else's link is not a change of preference.
    if (STATE.view !== 'cards' && (!target || !target.offsetParent)){
      STATE.view = 'cards';
      writeState('replace');
      syncControls();
      render();
      target = document.getElementById(location.hash.slice(1));
    }
    if (!target) return;
    target.querySelector('details')?.setAttribute('open', '');
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      target.classList.add('entry-focus');
      setTimeout(() => target.classList.remove('entry-focus'), 1600);
    });
  };
  revealFromHash();
  addEventListener('hashchange', revealFromHash);}

// ---------- Command palette ----------
// One keystroke to the thing you wanted, without learning where the site put it. Every
// row is derived: entries come from the same haystack() and score() the list uses, and
// the filter and sort rows are read off the toolbar's own <option> elements rather than
// from a second list of labels that could drift from them.
//
// Registry page only, deliberately. What it is for is searching the registry, which needs
// data/entries.json and this file's filtering; a finding page would have to download all
// of both to answer. The shortcut sheet is registry-only for the same reason.
//
// Everything here runs after bootStatic(), so it is past every span verify-parity.py
// slices out and evaluates in a bare Node process. Nothing above that point may touch
// the DOM.
function wirePalette(){
  const dlg = document.getElementById('cmdk');
  const input = document.getElementById('cmdk-q');
  const list = document.getElementById('cmdk-list');
  if (!dlg || !input || !list) return;

  let rows = [];      // what is currently rendered, in order
  let at = 0;         // the active row
  let opener = null;  // focus to restore on close
  let usePointer = false; // suppress hover-tracking until the pointer actually moves

  // Reading the labels off the rendered <option>s means the palette says "Peer reviewed"
  // and "Newest first" because the toolbar does, in every vocabulary, with no table here
  // to keep in step.
  const opts = id => [...(document.getElementById(id)?.options || [])]
    .filter(o => o.value)
    .map(o => ({ value: o.value, label: o.text }));

  const setFilter = (key, value) => () => { STATE[key] = value; update('push'); };

  function commands(){
    const out = [];
    for (const key of ['field','lab','ver','aut','since'])
      for (const o of opts(key))
        out.push({ label: o.label, hint: FILTER_NAME[key], keywords: key, run: setFilter(key, o.value) });
    for (const o of opts('sort'))
      out.push({ label: o.label, hint: 'Sort', keywords: 'sort order', run: () => { STATE.sort = o.value; update('push'); } });
    out.push(
      { label: 'Card view', hint: 'Layout', keywords: 'cards view layout',
        run: () => document.querySelector('.view-seg .vw[data-view="cards"]')?.click() },
      { label: 'Table view', hint: 'Layout', keywords: 'table view layout',
        run: () => document.querySelector('.view-seg .vw[data-view="table"]')?.click() });
    // Theme rows click the header control rather than writing localStorage here: chrome.js
    // owns the transition and the browser-chrome tint, and one owner is the point.
    for (const mode of ['light','system','dark'])
      out.push({ label: `Theme: ${mode}`, hint: 'Theme', keywords: 'theme appearance dark light',
                 run: () => document.querySelector(`.theme-seg .th[data-mode="${mode}"]`)?.click() });
    out.push(
      { label: 'Clear all filters', hint: 'Action', keywords: 'reset clear filters',
        run: () => { for (const k of FILTERS) STATE[k] = DEFAULTS[k]; update('push'); } },
      { label: 'Copy a link to this view', hint: 'Action', keywords: 'share link url',
        run: () => document.getElementById('share')?.click() },
      { label: 'Export this view as CSV', hint: 'Action', keywords: 'download export csv',
        run: () => document.getElementById('csv')?.click() });
    for (const [label, href] of [['Methodology','/methodology'], ['Review queue','/review'],
                                 ['Contributors','/contributors'], ['Every chart','/visuals'],
                                 ['Contribute','/contribute']])
      out.push({ label, hint: 'Page', keywords: 'go to page ' + href, run: () => { location.href = href; } });
    return out;
  }

  let COMMANDS = null;

  function build(q){
    if (!COMMANDS) COMMANDS = commands();
    const n = q.trim().toLowerCase();
    const cmds = (n
      ? COMMANDS.filter(c => (c.label + ' ' + c.hint + ' ' + c.keywords).toLowerCase().includes(n))
      : COMMANDS).slice(0, 8);
    // Entries need the registry. Before it lands there is nothing to offer but commands,
    // which is why ensureData() is called on open and this re-runs when it resolves.
    const hits = n && ALL.length
      ? ALL.filter(e => haystack(e).includes(n))
           .sort((a, b) => score(b, n) - score(a, n) || b.date.localeCompare(a.date))
           .slice(0, 7)
           .map(e => ({ label: e.title, hint: e.lab, run: () => { location.href = '/finding/' + e.id; } }))
      : [];
    // With nothing typed there is nothing to match, so the commands are the whole answer.
    //
    // Once there is a query the entries lead, because the title someone half-remembers is
    // the common case. The exception is a query that names a command: "Peer reviewed"
    // otherwise ranked five entries that merely mention the phrase above the filter of
    // that exact name, so typing a command in full ran an entry instead. A command whose
    // label starts with the query goes first; anything less than that is a guess.
    if (!n) return cmds;
    const named = cmds.filter(c => c.label.toLowerCase().startsWith(n));
    return named.concat(hits, cmds.filter(c => !named.includes(c)));
  }

  function draw(){
    list.innerHTML = rows.length
      ? rows.map((r, i) =>
          `<li class="cmdk-row${i === at ? ' is-active' : ''}" role="option" id="cmdk-o-${i}"`
          + ` aria-selected="${i === at ? 'true' : 'false'}">`
          + `<span class="cmdk-label">${esc(r.label)}</span>`
          + (r.hint ? `<span class="cmdk-hint">${esc(r.hint)}</span>` : '')
          + `</li>`).join('')
      : `<li class="cmdk-empty" role="presentation">Nothing matches</li>`;
    input.setAttribute('aria-activedescendant', rows.length ? 'cmdk-o-' + at : '');
    rows.length && list.children[at]?.scrollIntoView({ block: 'nearest' });
  }

  function refresh(){
    rows = build(input.value);
    at = 0;
    draw();
  }

  function move(step){
    if (!rows.length) return;
    at = (at + step + rows.length) % rows.length;
    usePointer = false;
    draw();
  }

  function run(){
    const row = rows[at];
    if (!row) return;
    dlg.close();
    row.run();
  }

  function open(){
    opener = document.activeElement;
    input.value = '';
    refresh();
    dlg.showModal();
    input.focus();
    // The list is worth having the moment it arrives, so a palette opened on a cold page
    // fills in behind the commands rather than making the visitor type again.
    ensureData().then(() => { if (dlg.open) refresh(); });
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown'){ ev.preventDefault(); move(1); }
    else if (ev.key === 'ArrowUp'){ ev.preventDefault(); move(-1); }
    else if (ev.key === 'Home'){ ev.preventDefault(); at = 0; usePointer = false; draw(); }
    else if (ev.key === 'End'){ ev.preventDefault(); at = Math.max(0, rows.length - 1); usePointer = false; draw(); }
    else if (ev.key === 'Enter'){ ev.preventDefault(); run(); }
    // Escape is the dialog's own, and closing is all it should do here.
  });
  list.addEventListener('click', ev => {
    const li = ev.target.closest('[role="option"]');
    if (!li) return;
    at = [...list.children].indexOf(li);
    run();
  });
  // Without the pointermove gate, a cursor resting over the list steals the active row
  // back from the arrow keys on the first repaint.
  list.addEventListener('pointermove', ev => {
    usePointer = true;
    const li = ev.target.closest('[role="option"]');
    if (!li || !usePointer) return;
    const i = [...list.children].indexOf(li);
    if (i !== at){ at = i; draw(); }
  });
  document.getElementById('cmdk-close')?.addEventListener('click', () => dlg.close());
  // showModal() returns focus to whatever opened it, except when that was the body, which
  // is exactly the keyboard-only case this exists for.
  dlg.addEventListener('close', () => { opener?.focus?.(); opener = null; });

  return open;
}

// ---------- Loading the registry ----------
// data/entries.json is well over 100 KB, and index.html already ships every one of its
// entries as pre-rendered markup. The JSON is needed only to filter, sort, search or export, so
// it is no longer fetched on the critical path: the page is readable and interactive
// first, and the data follows on idle, or the moment a control is touched, whichever
// comes first. A URL that arrives already filtered needs it at once and says so.
let dataPromise = null;

function ensureData(){
  if (dataPromise) return dataPromise;
  dataPromise = fetch('data/entries.json')
    .then(r => r.json())
    .then(bootData)
    .catch(() => {
      // Only replace the list if it is genuinely empty. On the built site the entries
      // are already in the markup, so a failed fetch costs search and filtering but
      // must not blank out content the visitor can otherwise read.
      const list = document.getElementById('list');
      if (list && !list.querySelector('.entry')) list.innerHTML =
        '<p class="empty">Run a local server to load entries:<br><code>python3 -m http.server</code></p>';
    });
  return dataPromise;
}

bootStatic();

if (document.getElementById('list') || document.getElementById('charts')){
  if (!pristine()){
    // The visitor asked for a specific view, so the pre-rendered one is wrong for them.
    ensureData();
  } else if (typeof requestIdleCallback === 'function'){
    // Fetched before it is wanted, but out of the way of the first paint. The timeout
    // matters: without it a page that never goes idle would never load the registry.
    requestIdleCallback(ensureData, { timeout: 2500 });
  } else {
    setTimeout(ensureData, 1200);
  }
}
