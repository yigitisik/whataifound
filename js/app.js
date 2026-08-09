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
  'journalofinfection.com':'Journal of Infection','cam.ac.uk':'Cambridge'
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
  const sortDesc = m => Object.entries(m).sort((a,b)=>b[1]-a[1]);
  const hbars = hbarsHtml;

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

  // One organisation dominates and a long tail holds a single finding each (29 orgs, 26
  // of them with one), so plotting every row made this the tallest card on the page and
  // stretched its whole grid row. Show the rows that carry information and aggregate the
  // rest, so the column still sums to the registry instead of silently truncating.
  //
  // MAXROWS is a height budget, not a ranking: everything above the tail is always kept,
  // then the tail is drawn from only to fill the card to a height that matches the topic
  // chart beside it. Tail entries are all tied, so which ones surface is arbitrary;
  // hence "and N more with one finding each" rather than a bare "Other", which would
  // imply the listed ones outrank the omitted ones.
  const labRows = sortDesc(tally(e=>e.lab));
  const MAXROWS = 11;                          // ~= the topic chart, this card's row-mate
  const TAIL = 1;                              // counts at or below this are tied filler
  const ranked = labRows.filter(([,c]) => c > TAIL);
  const tied = labRows.filter(([,c]) => c <= TAIL);
  // Keep every ranked row; spend what's left of the budget on tied rows, reserving one
  // slot for the aggregate row when it's needed.
  const room = Math.max(MAXROWS - ranked.length - 1, 0);
  const shown = tied.slice(0, tied.length <= room + 1 ? tied.length : room);
  const rest = tied.slice(shown.length);
  // Shortened rows keep the full organisation name in the tooltip, so nothing is lost.
  const labRow = ([l,c]) => LAB_SHORT[l] ? [LAB_SHORT[l], c, null, `${l}: ${c}`] : [l, c];
  const byLab = [
    ...ranked.map(labRow),
    ...shown.map(labRow),
    ...(rest.length ? [[`+${rest.length} more, 1 each`, rest.length, null,
      `${rest.length} further organisations with one finding each: `+
      rest.map(([l])=>l).join(', '), 'is-rollup']] : [])
  ];
  const gm = tally(e=>e.verification);
  const byGrade = GRADE_ORDER.filter(g=>gm[g]).map(g=>[GRADE_SHORT[g]||g, gm[g], `var(${GRADE_VAR[g]})`]);

  // Order matters, and a grid row is as tall as its tallest card, so row-mates are paired
  // by similar height: the fixed-height year bars with the grade breakdown, the matrix
  // with the five-row evidence chain, then the two long category lists together. The
  // evidence/autonomy matrix is the analytical centrepiece, so it stays in the second row
  // rather than below the whole strip, where reaching it took a deliberate scroll.
  //
  // The count has to stay even, or the last half-width card is orphaned beside dead space.
  // Eight half-width cards fill four rows exactly; the two list cards that want the room
  // take the full width and close the page.
  el.innerHTML =
    yearCard()+
    `<div class="qv-card"><h3 class="qv-title">By verification grade</h3>${hbars(byGrade,'By verification grade')}</div>`+
    matrixCard()+
    evidenceCard()+
    `<div class="qv-card"><h3 class="qv-title">By lab</h3>${hbars(byLab,'By lab')}</div>`+
    modelCard()+
    coverageCard()+
    spanCard()+
    // 8 rather than the home page's 4, and full width: these rows carry a title, and a
    // half-width column clamps most of them to two lines.
    standingCard(8, 'qv-wide')+
    // 0 = no cap: this page has the width for all of them, the home page does not.
    topicCard(0, 'qv-wide');
  renderInsights();
  wireScatterTip();
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

  const cards = [
    [`${strong}`, `of ${n} well verified`,
     `Formally verified, independently checked or peer reviewed. ${pct(strong)}% of the registry.`],
    [`${scaffold}`, 'came from search scaffolds',
     'An LLM inside a human-built search loop (FunSearch, AlphaEvolve), not a model reasoning on its own.'],
    [`${negative}`, 'negative or contested',
     'Already known, disputed or refuted. Kept on the record rather than deleted.'],
  ];
  if (median != null) cards.push([`${median}yr`, 'median problem age',
    `Half the problems with a known posed year had stood longer than this before the result.`]);

  el.innerHTML = cards.map(([big, label, note]) =>
    `<div class="ins"><b>${esc(big)}</b><span class="ins-l">${esc(label)}</span>`+
    `<span class="ins-n">${esc(note)}</span></div>`).join('');
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
// coverage, so a bar is the share of entries carrying that kind of link at all: 48 of 52
// has to read as nearly full and 8 of 52 as nearly empty. Max-scaling would draw the
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

// ---------- Charts /visuals mounts and the home page does not ----------
// These three have no port in build-site.py and no parity row, because nothing
// pre-renders them: /visuals is the only page that shows them, and it fetches the
// registry and renders client side. Keep it that way. A card that ever needs to appear
// on the home page has to be ported first, like the five above.

// `model` is deliberately precise about what ran, so 52 entries carry 47 distinct
// strings and a raw tally is a list of ones. Group on the system rather than the release:
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

// How long the problems stood. The insight strip states the median; this is the shape
// behind it, and the shape is the part worth seeing: of the entries recording a posed
// year, most had stood fifty years or more, and none closed a problem posed in the last
// five. Empty buckets are drawn rather than dropped, for the same reason yearCard() draws
// its quiet years: a gap in the middle of the range is a fact about the registry.
const SPAN_BUCKETS = [
  [0, 4, 'Under 5 yrs'], [5, 9, '5 to 9 yrs'], [10, 24, '10 to 24 yrs'],
  [25, 49, '25 to 49 yrs'], [50, Infinity, '50 yrs or more'],
];
function spanCard(){
  const spans = ALL.map(yearsOpen).filter(v => v != null);
  const rows = SPAN_BUCKETS.map(([lo,hi,label]) =>
    [label, spans.filter(v => v >= lo && v <= hi).length]);
  return `<div class="qv-card"><h3 class="qv-title">How long the problem stood</h3>`+
    hbarsHtml(rows, 'How long the problem stood')+
    `<p class="qv-foot">From the ${spans.length} of ${ALL.length} entries recording a `+
    `posed year. <a href="/review">Add a missing one</a>.</p></div>`;
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

  const MARK = '.mx-dot';
  wrap.addEventListener('pointerover', e => { const d = e.target.closest(MARK); if (d) show(d); });
  wrap.addEventListener('pointerout', e => { if (e.target.closest(MARK)) hide(); });
  wrap.addEventListener('focusin', e => { const d = e.target.closest(MARK); if (d) show(d); });
  wrap.addEventListener('focusout', e => { if (e.target.closest(MARK)) hide(); });
}

// ---------- View state ----------
// Every view of the registry is a URL. The search box, the four filters and the sort
// order all live in the query string, so a filtered view can be linked, bookmarked and
// stepped back through with the browser's own back button. index.html's SearchAction
// JSON-LD has advertised /?q=… since the site launched; reading it here is what makes
// that claim true rather than aspirational.
const PARAMS = ['q', 'field', 'lab', 'ver', 'aut', 'tag', 'sort', 'view'];
const DEFAULTS = { q:'', field:'', lab:'', ver:'', aut:'', tag:'', sort:'date-desc', view:'table' };
// The filters proper: the ones that narrow the list, as opposed to reordering it. The
// chips, the empty state and the pristine test all work from this, not from PARAMS.
const FILTERS = ['q', 'field', 'lab', 'ver', 'aut', 'tag'];
const FILTER_NAME = { q:'Search', field:'Field', lab:'Lab', ver:'Verification',
                      aut:'Autonomy', tag:'Tag' };
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
// "claim", "com" and "http" each matched all 52 entries and the box appeared to do
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

// Table or cards. The table is the default: a registry is for scanning, and 52 tall
// cards is one long scroll. A preference rather than a property of the link, so it is
// remembered the way the theme is, and a URL without ?view= opens the way this visitor
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
  // empty list the visitor has no way to explain.
  if (!SORTS[STATE.sort]) STATE.sort = DEFAULTS.sort;
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

// Written as a function of (entry, state) rather than of the DOM, so the empty state can
// re-run it with a single filter lifted to work out which one to suggest dropping.
function matches(e, s){
  return (!s.field || e.field === s.field)
      && (!s.lab   || e.lab === s.lab)
      && (!s.ver   || e.verification === s.ver)
      && (!s.aut   || e.autonomy === s.aut)
      && (!s.tag   || (e.tags || []).includes(s.tag))
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

function selected(){ return ALL.filter(e => matches(e, STATE)).sort(SORTS[STATE.sort]); }

function filterValue(k, v){
  if (k === 'ver') return VER_LABEL[v] || v;
  if (k === 'aut') return AUT_LABEL[v] || v;
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
  for (const id of ['q', 'field', 'lab', 'ver', 'aut', 'sort']){
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

  // Same rule as build-site.py's `updated`: the latest date the data carries, counting
  // revisions as well as additions. Both halves matter, or this overwrites the
  // pre-rendered stamp with an older one and the badge contradicts the activity feed
  // three inches to its left.
  const updated = document.getElementById('updated');
  if (updated) updated.textContent =
    ALL.flatMap(e => [e.added, ...(e.revisions || []).map(r => r.date)])
       .filter(Boolean).sort().pop() || ALL[0]?.date || '';

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
  ['field','lab','ver','aut','sort'].forEach(id =>
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
      return;
    }
    const btn = ev.target.closest('.vid-play');
    if (!btn) return;
    const box = btn.closest('.vid');
    const id = encodeURIComponent(box.dataset.yt || '');
    const wrap = document.createElement('div');
    wrap.className = 'vid-frame';
    wrap.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1"
      title="YouTube video player" allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen loading="lazy"></iframe>`;
    box.replaceWith(wrap);
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
    for (const key of ['field','lab','ver','aut'])
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
// data/entries.json is 143 KB, and index.html already ships every one of its 52 entries
// as pre-rendered markup. The JSON is needed only to filter, sort, search or export, so
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
