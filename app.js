const VER_LABEL = {
  'formal':'Formally verified','independent':'Independently checked','peer-reviewed':'Peer reviewed',
  'author-verified':'Author verified','claimed':'Claimed','disputed':'Disputed',
  'known':'Already known','refuted':'Refuted'
};
const AUT_LABEL = {
  'autonomous':'Autonomous','ai-led':'AI-led','collaborative':'Collaborative',
  'ai-assisted':'AI-assisted','search-scaffold':'Search scaffold','retrieval':'Retrieval'
};
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
let ALL = [], first = true;

// Theme: light / dark / system. Top-to-bottom wipe via View Transitions.
(function(){
  const btns = [...document.querySelectorAll('.theme-seg .th')];
  if (!btns.length) return;
  // Default is dark: a first-time visitor (no stored choice) gets dark, not the OS setting.
  const current = () => { try { return localStorage.getItem('theme') || 'dark'; } catch(e){ return 'dark'; } };
  const sync = mode => btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
  const apply = mode => {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    sync(mode);
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
  'nobelprize.org':'Nobel Prize','actu.epfl.ch':'EPFL','storage.googleapis.com':'DeepMind'
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
      <h2>${esc(e.title)}<a class="permalink" href="#e-${esc(e.id)}" data-permalink="e-${esc(e.id)}" aria-label="Copy link to this entry" title="Copy link to this entry">#</a></h2>
      <p class="claim">${esc(e.claim)}</p>
      ${e.detail ? `<p class="detail">${esc(e.detail)}</p>` : ''}
      ${e.humans?.length ? `<p class="withppl"><span>With</span><b>${esc(e.humans.join(', '))}</b></p>` : ''}
      ${e.tags?.length ? `<div class="tags">${e.tags.map(t=>`<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <details>
        <summary>Novelty check, caveats &amp; sources</summary>
        ${f('Novelty check', e.novelty_check)}
        ${f('Caveats', e.caveats)}
        ${checks ? `<div class="field checks reveal"><b>Independent checks</b>${checks}</div>` : ''}
        ${e.sources?.length ? `<div class="field reveal"><b>Sources</b>${refs(e.sources)}</div>` : ''}
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
    `<span class="vbar-fill" style="height:${Math.max(Math.round(c/ymax*92),2)}px"></span>`+
    `<span class="vbar-x">'${String(y).slice(2)}</span></div>`).join('') + `</div>`;

  const hbars = (rows, name) => {
    const max = Math.max(...rows.map(r=>r[1]), 1);
    const lab = name + '. ' + rows.map(([l,c])=>`${l}: ${c}`).join('; ');
    return `<div class="hbars" role="img" aria-label="${esc(lab)}">` + rows.map(([label,c,sw])=>
      `<div class="hbar" title="${esc(label)}: ${c}">`+
      `<span class="hbar-label">${sw?`<i class="sw" style="background:${sw}"></i>`:''}${esc(label)}</span>`+
      `<span class="hbar-track"><span class="hbar-fill" style="width:${Math.round(c/max*100)}%"></span></span>`+
      `<span class="hbar-val">${c}</span></div>`).join('') + `</div>`;
  };

  const byLab = sortDesc(tally(e=>e.lab));
  const byField = sortDesc(tally(e=>e.field));
  const GORDER = ['formal','independent','peer-reviewed','author-verified','claimed','disputed','known','refuted'];
  const GVAR = {formal:'--formal',independent:'--independent','peer-reviewed':'--peer','author-verified':'--author',
    claimed:'--claimed',disputed:'--disputed',known:'--known',refuted:'--refuted'};
  const GSHORT = {formal:'Formal',independent:'Independent','peer-reviewed':'Peer reviewed',
    'author-verified':'Author',claimed:'Claimed',disputed:'Disputed',known:'Already known',refuted:'Refuted'};
  const gm = tally(e=>e.verification);
  const byGrade = GORDER.filter(g=>gm[g]).map(g=>[GSHORT[g]||g, gm[g], `var(${GVAR[g]})`]);

  el.innerHTML =
    scatterCard()+
    `<div class="qv-card"><h3 class="qv-title">Findings per year</h3>${vbars}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By verification grade</h3>${hbars(byGrade,'By verification grade')}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By lab</h3>${hbars(byLab,'By lab')}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By topic area</h3>${hbars(byField,'By topic area')}</div>`;
  wireScatterTip();
}

// Autonomy is the axis this registry owns, so it's the color key of the scatter:
// how famous a problem was (notability) vs how long it stood (years open),
// with each point tinted by how much the AI actually did.
const AUT_COLOR = {
  'autonomous':'var(--formal)','ai-led':'var(--independent)','collaborative':'var(--peer)',
  'ai-assisted':'var(--author)','search-scaffold':'var(--disputed)','retrieval':'var(--known)'
};
const AUT_ORDER = ['autonomous','ai-led','collaborative','ai-assisted','search-scaffold','retrieval'];

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

  const W = 520, H = 300, PADL = 44, PADR = 16, PADT = 14, PADB = 42;
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  // x = notability on a LOG scale: values span 1..56, so a linear axis would crush the
  // 1..19 cluster into the left edge. All counts are >= 1 (no article => no point), so
  // log is well-defined. y = years open, linear.
  const yMax = Math.max(...ys, 10);
  const xMax = Math.max(...xs, 10);
  const lx = v => Math.log10(Math.max(v, 1));
  const lxMax = lx(xMax);
  const px = x => PADL + (lx(x) / lxMax) * (W - PADL - PADR);
  const py = y => H - PADB - (y / yMax) * (H - PADT - PADB);

  // x-ticks at 1-2-5-10-20-50 style stops up to the max; y-ticks in rounded steps.
  const XSTOPS = [1,2,5,10,20,50,100,200];
  const xticks = XSTOPS.filter(v => v <= xMax * 1.001);
  if (xticks[xticks.length-1] < xMax) xticks.push(xMax);
  const yStep = Math.max(1, Math.ceil(yMax / 5 / 10) * 10);
  const yticks = []; for (let v = 0; v <= yMax; v += yStep) yticks.push(v);

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
    `<text x="${(PADL+(W-PADR))/2}" y="${H-4}" class="sc-axis" text-anchor="middle">Notability α — Wikipedia editions (log)</text>`+
    `<text x="13" y="${(PADT+(H-PADB))/2}" class="sc-axis" text-anchor="middle" transform="rotate(-90 13 ${(PADT+(H-PADB))/2})">Years open before result</text>`;

  // Legend: only autonomy classes actually present, in canonical order.
  const present = AUT_ORDER.filter(a => pts.some(p => p.e.autonomy === a));
  const legend = `<div class="sc-legend">` + present.map(a =>
    `<span class="sc-key"><i class="sw" style="background:${AUT_COLOR[a]}"></i>${esc(AUT_LABEL[a]||a)}</span>`).join('') + `</div>`;

  const note = missing ? `<p class="qv-foot">${missing} entr${missing===1?'y':'ies'} not plotted (no posed year or notability yet).</p>` : '';
  const label = `Scatter of years open versus notability, colored by autonomy. ${pts.length} entries plotted.`;

  return `<div class="qv-card qv-wide"><h3 class="qv-title">Years open vs. notability</h3>`+
    `<div class="sc-wrap">`+
    `<svg class="sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">`+
    grid + axisTitles + dots + `</svg>`+
    `<div class="sc-tip" hidden aria-hidden="true"></div>`+
    `</div>` + legend + note + `</div>`;
}

// Interactive tooltip for the scatter: shows on hover/focus of a dot, positioned
// inside the chart wrapper. Delegated + re-bindable so it survives chart re-renders.
function wireScatterTip(){
  const wrap = document.querySelector('.sc-wrap');
  if (!wrap) return;
  const tip = wrap.querySelector('.sc-tip');
  if (!tip) return;

  const show = dot => {
    const d = dot.dataset;
    tip.innerHTML =
      `<span class="sc-tip-t">${esc(d.title)}</span>`+
      `<span class="sc-tip-r"><i class="sw" style="background:${d.autcol}"></i>${esc(d.aut)}</span>`+
      `<span class="sc-tip-m">${esc(d.open)}</span>`+
      `<span class="sc-tip-m">Notability: ${esc(d.not)}</span>`+
      `<span class="sc-tip-m">Result: ${esc(d.year)}</span>`;
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

  wrap.addEventListener('pointerover', e => { const d = e.target.closest('.sc-dot'); if (d) show(d); });
  wrap.addEventListener('pointerout', e => { if (e.target.closest('.sc-dot')) hide(); });
  wrap.addEventListener('focusin', e => { const d = e.target.closest('.sc-dot'); if (d) show(d); });
  wrap.addEventListener('focusout', e => { if (e.target.closest('.sc-dot')) hide(); });
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
  list.innerHTML = out.length ? out.map(card).join('') : '<p class="empty">No entries match your filters.</p>';
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

  // Charts render wherever a #charts container exists — the registry page and the
  // standalone visuals page both mount it. Everything below is registry-only and is
  // skipped (via the #list guard) when app.js runs on visuals.html.
  renderCharts();

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
    statsEl.innerHTML =
      stats.map(([n,l])=>`<div class="stat"><b data-target="${n}">0</b><span>${l}</span></div>`).join('');
    document.querySelectorAll('#stats .stat b').forEach(el=> countUp(el, +el.dataset.target));
  }

  const fill = (id, vals, labels) => {
    const s = document.getElementById(id);
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
  document.getElementById('list').innerHTML =
    '<p class="empty">Run a local server to load entries:<br><code>python3 -m http.server</code></p>';
});
