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
        { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' });
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

// Visuals: a disclosure button that reveals the charts panel in place.
(function(){
  const btn = document.getElementById('btn-visuals');
  const panel = document.getElementById('panel-visuals');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) {
      renderCharts();   // rebuild so the bars animate in
      panel.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    }
  });
})();

// Sitemap rail: scroll-spy dot nav. Highlights the section in view; the Visuals
// entry only appears once that panel is actually open (it's a disclosure, not
// always part of the page flow).
(function(){
  const nav = document.querySelector('.sitenav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[data-target]')];
  const visualsItem = nav.querySelector('[data-optional="panel-visuals"]');
  const visualsPanel = document.getElementById('panel-visuals');

  const syncVisualsItem = () => {
    if (visualsItem) visualsItem.hidden = !visualsPanel || visualsPanel.hidden;
  };
  syncVisualsItem();
  document.getElementById('btn-visuals')?.addEventListener('click', () =>
    setTimeout(syncVisualsItem, 0));

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

  // The Visuals section mounts/unmounts from layout; re-check when it toggles.
  document.getElementById('btn-visuals')?.addEventListener('click', () => setTimeout(update, 0));

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
    `<div class="qv-card"><h3 class="qv-title">Findings per year</h3>${vbars}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By verification grade</h3>${hbars(byGrade,'By verification grade')}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By lab</h3>${hbars(byLab,'By lab')}</div>`+
    `<div class="qv-card"><h3 class="qv-title">By topic area</h3>${hbars(byField,'By topic area')}</div>`;
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
  const lastAdded = ALL.map(e=>e.added).filter(Boolean).sort().pop() || ALL[0]?.date || '';
  document.getElementById('updated').textContent = lastAdded;
  const citeDate = document.getElementById('cite-date');
  if (citeDate) citeDate.textContent = new Date().toISOString().slice(0, 10);
  const strong = ALL.filter(e=>['formal','independent','peer-reviewed'].includes(e.verification)).length;
  const auto = ALL.filter(e=>['autonomous','ai-led'].includes(e.autonomy)).length;
  const negative = ALL.filter(e=>['known','disputed','refuted'].includes(e.verification)).length;
  const stats = [
    [ALL.length,'Entries on record'], [strong,'Well verified'],
    [auto,'AI-led or autonomous'], [negative,'Negative or contested']
  ];
  document.getElementById('stats').innerHTML =
    stats.map(([n,l])=>`<div class="stat"><b data-target="${n}">0</b><span>${l}</span></div>`).join('');
  document.querySelectorAll('#stats .stat b').forEach(el=> countUp(el, +el.dataset.target));
  renderCharts();

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
