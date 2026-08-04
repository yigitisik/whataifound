// The maintainer's triage console.
//
// Deliberately plain. Every decision this page offers is one a maintainer could make by
// hand with a database client and a pull request, and the value it adds is that the
// submission and the person's track record are on screen at the same moment, which is
// what the decision actually depends on.
//
// Nothing here is a security boundary. /api/admin/proposals resolves the session and
// checks the role on every request, and would refuse a reader with this file open.
(function () {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const show = which => $$('.c-state').forEach(el => { el.hidden = el.dataset.state !== which; });

  const queue = $('[data-queue]');
  if (!queue) return;

  const KIND_LABEL = {
    check: 'Independent check', challenge: 'Grade challenge',
    entry: 'New entry', correction: 'Correction',
  };
  const STATUS_LABEL = {
    pending: 'Pending', pr_open: 'PR open', merged: 'Merged',
    rejected: 'Not accepted', needs_info: 'Needs info',
  };

  // Payload fields worth showing, per kind, in the order a reviewer reads them. An
  // allowlist rather than a dump of the object: a payload gains fields over time and a
  // console that renders whatever it finds turns into an unreadable wall.
  const FIELDS = {
    check: [['who', 'Checked by'], ['outcome', 'Outcome'], ['url', 'Link'],
            ['evidence', 'What they checked'], ['coi', 'Conflicts']],
    challenge: [['axis', 'Axis'], ['proposed', 'Proposed'], ['citation', 'Citation'],
                ['why', 'Argument']],
    correction: [['target', 'What'], ['year', 'Year'], ['url', 'Link'], ['label', 'Label'],
                 ['sourceKind', 'Source kind'], ['note', 'Note']],
    entry: [['id', 'Id'], ['title', 'Title'], ['claim', 'Claim'],
            ['verification', 'Verification'], ['autonomy', 'Autonomy'],
            ['field', 'Field'], ['date', 'Date'], ['lab', 'Lab'], ['model', 'Model'],
            ['novelty_check', 'Novelty check'], ['detail', 'Detail'], ['caveats', 'Caveats']],
  };

  // Only ever an http(s) link, and only ever rendered as one after parsing. An escaped
  // javascript: URL still runs on click, so the scheme is checked at the point of use
  // rather than trusted because a validator upstream should have caught it.
  function link(value) {
    let href;
    try { href = new URL(String(value)); } catch { return esc(value); }
    if (href.protocol !== 'https:' && href.protocol !== 'http:') return esc(value);
    return `<a href="${esc(href.href)}" target="_blank" rel="noopener noreferrer">${esc(href.href)}</a>`;
  }

  function fieldRows(kind, payload) {
    const spec = Object.hasOwn(FIELDS, kind) ? FIELDS[kind] : [];
    return spec.map(([key, label]) => {
      const v = payload && payload[key];
      if (v === undefined || v === null || v === '') return '';
      const body = /^https?:\/\//i.test(String(v)) ? link(v) : esc(v);
      return `<div class="ad-f"><dt>${esc(label)}</dt><dd>${body}</dd></div>`;
    }).join('');
  }

  function sourceRows(payload) {
    if (!Array.isArray(payload?.sources)) return '';
    return `<div class="ad-f"><dt>Sources</dt><dd><ul class="ad-src">`
      + payload.sources.map(s =>
        `<li><span class="pill k k-${esc(s.kind)}">${esc(s.kind)}</span> `
        + `${link(s.url)} <span class="ad-slabel">${esc(s.label)}</span></li>`).join('')
      + `</ul></dd></div>`;
  }

  function card(p) {
    const a = p.author || {};
    const who = a.handle ? `@${esc(a.handle)}` : 'unknown';
    const name = a.displayName ? ` <span class="ad-name">${esc(a.displayName)}</span>` : '';
    // The one number that changes how much scepticism a submission deserves.
    const record = a.submitted
      ? `${a.merged} of ${a.submitted} merged`
      : 'first submission';
    const status = Object.hasOwn(STATUS_LABEL, p.status) ? p.status : 'pending';
    const kind = Object.hasOwn(KIND_LABEL, p.kind) ? p.kind : 'check';
    const when = String(p.createdAt || '').slice(0, 10);

    const entry = p.entryId
      ? `<a href="/finding/${esc(p.entryId)}" target="_blank" rel="noopener">${esc(p.entryId)}</a>`
      : '<span class="ad-new">new entry</span>';

    const decided = p.status === 'pr_open' && p.prUrl
      ? `<p class="ad-pr">Pull request open:
         <a href="${esc(new URL(p.prUrl, 'https://github.com').href)}" target="_blank"
            rel="noopener">#${esc(p.prNumber)}</a>. Merge it there when you are satisfied.</p>`
      : '';

    return `<article class="ad-card" data-id="${esc(p.id)}">
      <header class="ad-head">
        <span class="pill r r-${esc(status)}">${esc(STATUS_LABEL[status])}</span>
        <span class="ad-kind">${esc(KIND_LABEL[kind])}</span>
        <span class="ad-entry">${entry}</span>
        <time class="ad-when">${esc(when)}</time>
      </header>
      <p class="ad-who">${who}${name}
        <span class="ad-record">${esc(record)}</span>
        ${a.orcid ? `<a class="credit-orcid" href="https://orcid.org/${esc(a.orcid)}"
           target="_blank" rel="noopener">iD</a>` : ''}
      </p>
      <dl class="ad-fields">${fieldRows(kind, p.payload)}${sourceRows(p.payload)}</dl>
      ${decided}
      <div class="ad-act">
        <textarea class="ad-note" rows="2" data-note
          placeholder="Why. Shown to the submitter, and required to reject or ask for more."></textarea>
        <div class="ad-btns">
          <button type="button" class="btn primary" data-decide="approve"
            ${p.status === 'pr_open' ? 'disabled' : ''}>Approve and open PR</button>
          <button type="button" class="btn" data-decide="needs_info">Ask for more</button>
          <button type="button" class="btn ad-no" data-decide="reject">Reject</button>
        </div>
        <p class="fld-err" data-err hidden></p>
      </div>
    </article>`;
  }

  async function load() {
    try {
      const r = await fetch('/api/admin/proposals', { headers: { accept: 'application/json' } });
      if (r.status === 401 || r.status === 404) { show('out'); return; }
      if (!r.ok) throw new Error('load');
      const data = await r.json();
      $('[data-nogithub]').hidden = data.github !== false;
      const rows = data.proposals || [];
      $('[data-count]').textContent = String(rows.length);
      queue.innerHTML = rows.map(card).join('');
      $('[data-empty]').hidden = rows.length > 0;
      show('in');
    } catch {
      show('out');
    }
  }

  queue.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-decide]');
    if (!btn) return;
    const card = btn.closest('.ad-card');
    const err = card.querySelector('[data-err]');
    err.hidden = true;
    const decision = btn.dataset.decide;
    const note = card.querySelector('[data-note]').value.trim();

    if (decision === 'approve'
        && !confirm('Open a pull request for this submission?\n\nIt still has to be merged by hand.')) {
      return;
    }

    card.querySelectorAll('[data-decide]').forEach(b => { b.disabled = true; });
    try {
      const r = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.dataset.id, decision, note }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        err.textContent = out.message || 'That did not work.';
        err.hidden = false;
        card.querySelectorAll('[data-decide]').forEach(b => { b.disabled = false; });
        return;
      }
      // Reload rather than patch the card in place: approving changes the row's status,
      // its buttons and its pull request link at once, and one source of truth for that
      // is the queue that was just written.
      load();
    } catch {
      err.textContent = 'Could not reach the server.';
      err.hidden = false;
      card.querySelectorAll('[data-decide]').forEach(b => { b.disabled = false; });
    }
  });

  $('[data-refresh]').addEventListener('click', load);

  const session = window.wafSession || Promise.resolve({ signedIn: false });
  session.then(data => {
    if (!data.signedIn) {
      const btn = $('[data-signin-btn]');
      if (btn) btn.href = '/api/auth/start?return_to=%2Fadmin';
      show('out');
      return;
    }
    load();
  }).catch(() => show('out'));
})();
