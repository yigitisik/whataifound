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

// Theme: light / dark / system. Top-to-bottom wipe via View Transitions.
(function(){
  const btns = [...document.querySelectorAll('.theme-seg .th')];
  if (!btns.length) return;
  // Default is dark: a first-time visitor (no stored choice) gets dark, not the OS setting.
  const current = () => { try { return localStorage.getItem('theme') || 'dark'; } catch(e){ return 'dark'; } };
  const sync = mode => btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
  // Browser-chrome tint on iOS/Android. Kept in step with the rendered theme, so the
  // bar above the page never disagrees with the page. 'system' resolves through the
  // media query, which is what the CSS does too.
  const tint = mode => {
    const m = document.querySelector('meta[name=theme-color]');
    if (!m) return;
    const light = mode === 'light' ||
      (mode === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
    m.content = light ? '#faf9f6' : '#111310';
  };
  const apply = mode => {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    sync(mode);
    tint(mode);
    try { localStorage.setItem('theme', mode); } catch(e){}
  };
  sync(current());
  btns.forEach(b => b.addEventListener('click', () => {
    const mode = b.dataset.mode;
    if (!document.startViewTransition || REDUCE) { apply(mode); return; }
    // The incoming theme is revealed as a horizontal edge sweeping down the viewport:
    // inset() insets from the bottom by 100% (nothing visible) to 0 (fully revealed).
    document.startViewTransition(() => apply(mode)).ready.then(() => {
      document.documentElement.animate(
        { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'] },
        { duration: 1000, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' });
    });
  }));
  // Under 'system' the CSS follows the OS live, so the tint has to as well; otherwise
  // flipping the OS theme with the page open leaves the chrome on the old colour.
  matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', () => { if (current() === 'system') tint('system'); });
})();

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
  if (src) return `<span class="labchip img" aria-hidden="true"><img src="${esc(src)}" alt=""></span>`;
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
  'jacobianfun.org':'jacobianfun.org'
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
      ? `<div class="rc-row"><dt class="rc-k">${esc(SRC_CHIP[kind])}</dt>`+
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
    return `<div class="rc-row"><dt class="rc-k">${esc(SRC_CHIP[kind])}</dt>`+
           `<dd class="rc-v">${shown}${extra}</dd></div>`;
  }).join('');
  return rows ? `<dl class="receipts">${rows}</dl>` : '';
}

// The same links inside the disclosure, grouped and with their full titles.
function groupedRefs(src){
  return SRC_ORDER.map(kind => {
    const of = (src || []).filter(s => s.kind === kind);
    if (!of.length) return '';
    return `<div class="field reveal"><b>${esc(SRC_LABEL[kind])}</b>`+
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
// notability = # of Wikipedia language editions with an article (English included),
// measured from the live API by build-notability.py. Absent means unrated.
function notabilityMeta(e){
  if (e.notability == null) return '';
  const v = e.notability;
  return `<div><dt>Notability</dt><dd>${v} Wikipedia edition${v===1?'':'s'}</dd></div>`;
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
        <span class="pill a">${esc(AUT_LABEL[e.autonomy]||e.autonomy)}</span>
      </div>
      <dl class="rmeta">
        <div><dt>Model</dt><dd>${esc(e.model)}</dd></div>
        <div><dt>Field</dt><dd>${esc(e.field)}</dd></div>
        ${openMeta(e)}
        ${notabilityMeta(e)}
      </dl>
    </div>
    <div class="body">
      <h2><a class="entry-link" href="/finding/${esc(e.id)}">${esc(e.title)}</a><a class="permalink" href="#e-${esc(e.id)}" data-permalink="e-${esc(e.id)}" aria-label="Copy link to this entry" title="Copy link to this entry">#</a></h2>
      <p class="claim">${esc(e.claim)}</p>
      ${e.detail ? `<p class="detail">${esc(e.detail)}</p>` : ''}
      ${e.humans?.length ? `<p class="withppl"><span>With</span><b>${esc(e.humans.join(', '))}</b></p>` : ''}
      ${e.tags?.length ? `<div class="tags">${e.tags.map(t=>`<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
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

  // Time series: findings per year, gaps filled
  const years = ALL.map(e=>+e.date.slice(0,4));
  const y0=Math.min(...years), y1=Math.max(...years), byYear=[];
  for (let y=y0; y<=y1; y++) byYear.push([y, years.filter(v=>v===y).length]);
  const ymax = Math.max(...byYear.map(d=>d[1]), 1);
  const vLabel = 'Findings per year. ' + byYear.map(([y,c])=>`${y}: ${c}`).join('; ');
  const vbars = `<div class="vbars" role="img" aria-label="${esc(vLabel)}">` + byYear.map(([y,c])=>
    `<div class="vbar" title="${y}: ${c} finding${c===1?'':'s'}">`+
    `<span class="vbar-val">${c}</span>`+
    `<span class="vbar-fill" style="height:${Math.max(Math.round(c/ymax*72),2)}px"></span>`+
    `<span class="vbar-x">'${String(y).slice(2)}</span></div>`).join('') + `</div>`;

  // rows are [label, count, swatch?, titleOverride?, cls?]. The override carries the long
  // form (a full org name, or the roster behind an aggregated row) into the tooltip
  // while the visible label stays short enough for the label column.
  const hbars = (rows, name) => {
    const max = Math.max(...rows.map(r=>r[1]), 1);
    const lab = name + '. ' + rows.map(([l,c])=>`${l}: ${c}`).join('; ');
    return `<div class="hbars" role="img" aria-label="${esc(lab)}">` + rows.map(([label,c,sw,tt,cls])=>
      `<div class="hbar${cls?' '+cls:''}" title="${esc(tt || `${label}: ${c}`)}">`+
      `<span class="hbar-label">${sw?`<i class="sw" style="background:${sw}"></i>`:''}${esc(label)}</span>`+
      `<span class="hbar-track"><span class="hbar-fill" style="width:${Math.round(c/max*100)}%"></span></span>`+
      `<span class="hbar-val">${c}</span></div>`).join('') + `</div>`;
  };

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
  const byField = sortDesc(tally(e=>e.field)).map(([f,c]) => [FIELD_SHORT[f]||f, c]);
  const GORDER = ['formal','independent','peer-reviewed','author-verified','claimed','disputed','known','refuted'];
  const GVAR = {formal:'--formal',independent:'--independent','peer-reviewed':'--peer','author-verified':'--author',
    claimed:'--claimed',disputed:'--disputed',known:'--known',refuted:'--refuted'};
  const GSHORT = {formal:'Formal',independent:'Independent','peer-reviewed':'Peer reviewed',
    'author-verified':'Author',claimed:'Claimed',disputed:'Disputed',known:'Already known',refuted:'Refuted'};
  const gm = tally(e=>e.verification);
  const byGrade = GORDER.filter(g=>gm[g]).map(g=>[GSHORT[g]||g, gm[g], `var(${GVAR[g]})`]);

  // Order matters, and a grid row is as tall as its tallest card, so row-mates are paired
  // by similar height: fixed-height year bars with the 7-row grade breakdown, then the two
  // capped category lists together. The scatter is the analytical centrepiece, so it comes
  // third (one grid row down, inside the opening view) rather than below four cards,
  // where reaching it took a deliberate scroll.
  el.innerHTML =
    `<div class="qv-card"><h3 class="qv-title">Findings per year</h3>${vbars}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By verification grade</h3>${hbars(byGrade,'By verification grade')}</div>`+
    scatterCard()+
    matrixCard()+
    `<div class="qv-card"><h3 class="qv-title">By lab</h3>${hbars(byLab,'By lab')}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By topic area</h3>${hbars(byField,'By topic area')}</div>`;
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

// Autonomy is the axis this registry owns, so it's the color key of the scatter:
// how famous a problem was (notability) vs how long it stood (years open),
// with each point tinted by how much the AI actually did.
const AUT_COLOR = {
  'autonomous':'var(--formal)','ai-led':'var(--independent)','collaborative':'var(--peer)',
  'ai-assisted':'var(--author)','search-scaffold':'var(--disputed)','retrieval':'var(--known)'
};
const AUT_ORDER = ['autonomous','ai-led','collaborative','ai-assisted','search-scaffold','retrieval'];

// Chart labels for the `field` slugs. Unlisted fields fall back to the raw value, so a
// new one still renders; it just reads as the slug until it is named here.
const FIELD_SHORT = {
  'mathematics':'Mathematics','computer-science':'Computer science','biology':'Biology',
  'materials':'Materials','physics':'Physics','chemistry':'Chemistry','medicine':'Medicine',
  'neuroscience':'Neuroscience','astronomy':'Astronomy','archaeology':'Archaeology',
  'engineering':'Engineering','climate':'Climate','economics':'Economics'
};

function scatterCard(){
  // x = notability (α, fame); y = years open before the result. Color = autonomy.
  // Only entries with both fields can be placed; the rest are noted, not silently dropped.
  const pts = ALL.map(e => ({e, x: e.notability, y: yearsOpen(e)}))
                 .filter(p => p.x != null && p.y != null);
  const missing = ALL.length - pts.length;
  if (pts.length < 2){
    return `<div class="qv-card qv-wide"><h3 class="qv-title">Years open vs. notability</h3>`+
      `<p class="qv-empty">Not enough entries carry both a posed year and a notability score yet.</p></div>`;
  }

  // Sized to sit beside the matrix in one grid row, so the box matches that card's
  // proportions rather than the full page width it used to span.
  const W = 440, H = 300, PADL = 44, PADR = 14, PADT = 12, PADB = 58;
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  // x = notability on a LOG scale: values span 1..56, so a linear axis would crush the
  // 1..19 cluster into the left edge. All counts are >= 1 (no article => no point), so
  // log is well-defined.
  //
  // y = years open on a SQRT scale. One problem stood 331 years and the next longest 87,
  // so a linear axis spent about three quarters of its height on empty space above the
  // cluster and stacked the other points on the baseline. Sqrt pulls the outlier in while
  // keeping 0 at 0 (unlike log) and the ordering exact, so the card earns its height
  // instead of padding it. Ticks are labelled in plain years, so the axis still reads
  // directly even though the spacing is non-linear.
  const yMax = Math.max(...ys, 10);
  const xMax = Math.max(...xs, 10);
  const lx = v => Math.log10(Math.max(v, 1));
  const lxMax = lx(xMax);
  const sy = v => Math.sqrt(Math.max(v, 0));
  const syMax = sy(yMax);
  const px = x => PADL + (lx(x) / lxMax) * (W - PADL - PADR);
  const py = y => H - PADB - (sy(y) / syMax) * (H - PADT - PADB);

  // x-ticks at 1-2-5-10-20-50 style stops up to the max.
  const XSTOPS = [1,2,5,10,20,50,100,200];
  const xticks = XSTOPS.filter(v => v <= xMax * 1.001);
  if (xticks[xticks.length-1] < xMax) xticks.push(xMax);
  // y-ticks from fixed round stops rather than a constant step: the axis is sqrt-scaled,
  // so an even step would bunch the upper gridlines together. The data max is always
  // labelled (the outlier should be readable, not merely implied), then round stops fill
  // in below it, but only where they clear MINGAP pixels of their neighbours, otherwise
  // sqrt compression prints overlapping labels like "331" over "300".
  const MINGAP = 14;
  const YSTOPS = [0,10,25,50,100,200,300,500,750,1000];
  const yticks = [yMax];
  YSTOPS.filter(v => v < yMax).reverse().forEach(v => {
    if (yticks.every(k => Math.abs(py(v) - py(k)) >= MINGAP)) yticks.push(v);
  });
  yticks.sort((a,b) => a-b);

  const grid = [
    ...xticks.map(v => `<line x1="${px(v).toFixed(1)}" y1="${PADT}" x2="${px(v).toFixed(1)}" y2="${H-PADB}" class="sc-grid"/>`+
      `<text x="${px(v).toFixed(1)}" y="${H-PADB+16}" class="sc-tick" text-anchor="middle">${v}</text>`),
    ...yticks.map(v => `<line x1="${PADL}" y1="${py(v).toFixed(1)}" x2="${W-PADR}" y2="${py(v).toFixed(1)}" class="sc-grid"/>`+
      `<text x="${PADL-6}" y="${(py(v)+3.5).toFixed(1)}" class="sc-tick" text-anchor="end">${v}</text>`)
  ].join('');

  // Deterministic jitter so coincident points fan out without Math.random(); seeded by index.
  const dots = pts.map((p,i) => {
    const jx = ((i * 37) % 11 - 5) * 0.6, jy = ((i * 53) % 9 - 4) * 0.6;
    const cx = (px(p.x)+jx).toFixed(1), cy = (py(p.y)+jy).toFixed(1);
    const col = AUT_COLOR[p.e.autonomy] || 'var(--muted)';
    const nt = `${p.x} Wikipedia edition${p.x===1?'':'s'}`;
    // Data attributes drive the interactive HTML tooltip (richer than SVG <title>).
    return `<circle cx="${cx}" cy="${cy}" r="6" fill="${col}" class="sc-dot" tabindex="0" role="img"`+
      ` data-title="${esc(p.e.title)}"`+
      ` data-aut="${esc(AUT_LABEL[p.e.autonomy]||p.e.autonomy)}"`+
      ` data-autcol="${col}"`+
      ` data-open="posed ${esc(String(p.e.year_posed))} · open ${p.y} yr${p.y===1?'':'s'}"`+
      ` data-not="${esc(nt)}"`+
      ` data-year="${esc(String(p.e.date).slice(0,4))}"`+
      ` aria-label="${esc(`${p.e.title}. Open ${p.y} years, notability ${p.x}, ${AUT_LABEL[p.e.autonomy]||p.e.autonomy}.`)}">`+
      `</circle>`;
  }).join('');

  const axisTitles =
    `<text x="${(PADL+(W-PADR))/2}" y="${H-4}" class="sc-axis" text-anchor="middle">Notability α, Wikipedia editions (log)</text>`+
    `<text x="13" y="${(PADT+(H-PADB))/2}" class="sc-axis" text-anchor="middle" transform="rotate(-90 13 ${(PADT+(H-PADB))/2})">Years open before result</text>`;

  // Legend: only autonomy classes actually present, in canonical order.
  const present = AUT_ORDER.filter(a => pts.some(p => p.e.autonomy === a));
  const legend = `<div class="sc-legend">` + present.map(a =>
    `<span class="sc-key"><i class="sw" style="background:${AUT_COLOR[a]}"></i>${esc(AUT_LABEL[a]||a)}</span>`).join('') + `</div>`;

  const note = missing ? `<p class="qv-foot">${missing} entr${missing===1?'y':'ies'} not plotted (no posed year or notability yet).</p>` : '';
  const label = `Scatter of years open versus notability, colored by autonomy. ${pts.length} entries plotted.`;

  return `<div class="qv-card"><h3 class="qv-title">Years open vs. notability</h3>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">`+
    grid + axisTitles + dots + `</svg>`+
    `<div class="sc-tip" hidden aria-hidden="true"></div>`+
    `</div>` + legend + note + `</div>`;
}

// The registry's own two axes plotted against each other: how much the AI did (x) by
// how well the result is stood up (y). Unlike the notability scatter, every entry has
// both grades, so this one plots the whole registry.
//
// It is a matrix, not a scatter, because both axes are ordinal with few levels: 52
// entries land in only ~15 distinct combinations, and one cell alone holds 18. Drawn as
// points they would sit on top of each other and hide two thirds of the data, so each
// cell is a single mark whose area encodes how many entries share it.
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

// Interactive tooltip for the plots: shows on hover/focus of a mark, positioned inside
// its own chart wrapper. Delegated + re-bindable so it survives chart re-renders, and
// bound per wrapper so each plot's tooltip stays inside that plot's card.
//
// The rows are driven by which data attributes a mark carries rather than by which chart
// it belongs to, so the two plots share one implementation: the scatter sets notability
// and result-year, the matrix sets neither and lists its entries in `open` instead.
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
      (d.open ? `<span class="sc-tip-m">${esc(d.open)}</span>` : '')+
      (d.not ? `<span class="sc-tip-m">Notability: ${esc(d.not)}</span>` : '')+
      (d.year ? `<span class="sc-tip-m">Result: ${esc(d.year)}</span>` : '');
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

  const MARK = '.sc-dot,.mx-dot';
  wrap.addEventListener('pointerover', e => { const d = e.target.closest(MARK); if (d) show(d); });
  wrap.addEventListener('pointerout', e => { if (e.target.closest(MARK)) hide(); });
  wrap.addEventListener('focusin', e => { const d = e.target.closest(MARK); if (d) show(d); });
  wrap.addEventListener('focusout', e => { if (e.target.closest(MARK)) hide(); });
}

function render(){
  const q = document.getElementById('q').value.toLowerCase();
  const fv = document.getElementById('field').value;
  const lv = document.getElementById('lab').value;
  const vv = document.getElementById('ver').value;
  const out = ALL.filter(e =>
    (!fv || e.field===fv) && (!lv || e.lab===lv) && (!vv || e.verification===vv) &&
    (!q || JSON.stringify(e).toLowerCase().includes(q)));
  const list = document.getElementById('list');
  // build-site.py has already written these exact cards into index.html. Rewriting
  // identical markup on load would throw away the parsed DOM (and any <details> the
  // browser restored on a back-navigation) for no visual change, so the first paint
  // is skipped and the server-rendered markup is adopted as-is. Every later call
  // (any search or filter) renders normally.
  if (list.hasAttribute('data-prerendered')) {
    list.removeAttribute('data-prerendered');
  } else {
    list.innerHTML = out.length ? out.map(card).join('') : '<p class="empty">No entries match your filters.</p>';
  }
  document.getElementById('count').textContent =
    `${out.length} / ${ALL.length} ${out.length===1?'entry':'entries'}`;
  // Stagger only on the first paint so filtering stays instant.
  if (first && !REDUCE){
    list.classList.add('animate');
    [...list.children].forEach((el,i)=> el.style.setProperty('--d', Math.min(i*45,520)+'ms'));
  } else {
    list.classList.remove('animate');
  }
  first = false;
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

function boot(data){
  ALL = data.sort((a,b)=> b.date.localeCompare(a.date));

  // Charts render wherever a #charts container exists: the registry page and the
  // standalone visuals page both mount it. Everything below is registry-only and is
  // skipped (via the #list guard) when app.js runs on visuals.html.
  renderCharts();

  // The homepage hero has no #charts grid: its matrix is pre-rendered into the markup by
  // build-site.py, so renderCharts() returned before reaching wireScatterTip(). Wire the
  // plots already in the DOM instead. Guarded so the visuals page doesn't wire twice.
  if (!document.getElementById('charts')) wireScatterTip();

  const updated = document.getElementById('updated');
  if (updated) updated.textContent =
    ALL.map(e=>e.added).filter(Boolean).sort().pop() || ALL[0]?.date || '';
  const citeDate = document.getElementById('cite-date');
  if (citeDate) citeDate.textContent = new Date().toISOString().slice(0, 10);

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
  ['q','field','lab','ver'].forEach(id =>
    document.getElementById(id).addEventListener('input', render));
  document.getElementById('list').addEventListener('click', ev => {
    const link = ev.target.closest('.permalink');
    if (link) {
      ev.preventDefault();
      const id = link.dataset.permalink;
      const url = location.origin + location.pathname + '#' + id;
      const flash = () => {
        link.classList.add('copied');
        setTimeout(() => link.classList.remove('copied'), 1100);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(flash, flash);
      else flash();
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
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    target.querySelector('details')?.setAttribute('open', '');
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      target.classList.add('entry-focus');
      setTimeout(() => target.classList.remove('entry-focus'), 1600);
    });
  };
  revealFromHash();
  addEventListener('hashchange', revealFromHash);
}

fetch('data/entries.json').then(r=>r.json()).then(boot).catch(()=>{
  // Only replace the list if it is genuinely empty. On the built site the entries are
  // already in the markup, so a failed fetch costs search and filtering but must not
  // blank out content the visitor can otherwise read.
  const list = document.getElementById('list');
  if (list && !list.querySelector('.entry')) list.innerHTML =
    '<p class="empty">Run a local server to load entries:<br><code>python3 -m http.server</code></p>';
});
