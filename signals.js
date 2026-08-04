// Triage signals, on the two pages that have them: a finding page (three buttons) and
// the review queue (counts, and an optional reorder).
//
// One file for both because the two surfaces share the fetch, the shape of the reply
// and the rule about what a signal means. It is loaded after entry.js on a finding page
// and is the only script on the review page, which until now loaded none.
//
// Everything here is additive. The markup it hydrates ships hidden, so a reader with
// scripting off gets the page exactly as it was before signals existed rather than a
// row of buttons that do nothing.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const group = document.querySelector('[data-signals]');
  const queue = document.querySelector('[data-qsort]');
  if (!group && !queue) return;

  // One request serves both pages. The finding page scopes it to its own entry; the
  // queue needs every entry to sort by.
  const entryId = group && group.dataset.signals;
  const url = entryId ? `/api/signals?entry=${encodeURIComponent(entryId)}` : '/api/signals';

  const total = counts => Object.values(counts || {}).reduce((a, b) => a + b, 0);

  // ---------- finding page ----------
  function wireButtons(counts, mine) {
    const on = new Set(mine || []);
    const btns = [...group.querySelectorAll('.sig-b')];

    const paint = (btn, n, pressed) => {
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      const slot = btn.querySelector('[data-n]');
      // An empty count reads better as nothing than as a zero: a row of zeroes looks
      // like a scoreboard, which is the reading this feature is trying not to invite.
      slot.textContent = n > 0 ? String(n) : '';
    };

    btns.forEach(b => paint(b, (counts || {})[b.dataset.kind] || 0, on.has(b.dataset.kind)));
    group.hidden = false;

    let signedIn = null;   // resolved lazily, on the first click
    group.addEventListener('click', async ev => {
      const btn = ev.target.closest('.sig-b');
      if (!btn || btn.disabled) return;

      if (signedIn === null) {
        const s = await (window.wafSession || Promise.resolve({ signedIn: false }));
        signedIn = s.signedIn;
      }
      if (!signedIn) {
        // Not an error state. Signing in is the next step, so offer it in place of a
        // message that tells the reader what they cannot do.
        promptSignIn();
        return;
      }

      const kind = btn.dataset.kind;
      const was = btn.getAttribute('aria-pressed') === 'true';
      // Optimistic, and reverted below if the server disagrees. A toggle that waits for
      // a round trip before moving feels broken on a slow connection.
      paint(btn, ((counts || {})[kind] || 0) + (was ? -1 : 1), !was);
      btn.disabled = true;

      try {
        const r = await fetch('/api/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId, kind }),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) {
          paint(btn, (counts || {})[kind] || 0, was);
          if (r.status === 401) { signedIn = false; promptSignIn(); }
          return;
        }
        counts = out.counts || {};
        paint(btn, counts[kind] || 0, out.on);
      } catch {
        paint(btn, (counts || {})[kind] || 0, was);
      } finally {
        btn.disabled = false;
      }
    });
  }

  function promptSignIn() {
    let note = group.querySelector('.sig-signin');
    if (note) return;
    note = document.createElement('p');
    note.className = 'sig-signin';
    const here = location.pathname + location.search + location.hash;
    note.innerHTML = `<a href="/api/auth/start?return_to=${esc(encodeURIComponent(here))}">Sign in</a>`
      + ` to flag this. One account, one signal per kind.`;
    group.appendChild(note);
  }

  // ---------- review queue ----------
  function wireQueue(counts) {
    const rows = [...document.querySelectorAll('.q-row[data-entry]')];
    if (!rows.length) return;

    // The order the page shipped in, which is by evidence gap. Kept so "Evidence gap"
    // restores exactly the server's ordering rather than an approximation of it.
    rows.forEach((row, i) => { row.dataset.gap = String(i); });

    let flagged = 0;
    for (const row of rows) {
      const n = total(counts[row.dataset.entry]);
      row.dataset.signals = String(n);
      if (!n) continue;
      flagged++;
      const slot = row.querySelector('[data-sig]');
      if (!slot) continue;
      slot.textContent = `${n} flag${n === 1 ? '' : 's'}`;
      slot.hidden = false;
    }

    // Nothing has been flagged yet, so a control that reorders by flags would sort
    // nothing. Leave it hidden rather than offer a lever with no effect.
    if (!flagged) return;
    queue.hidden = false;

    queue.addEventListener('click', ev => {
      const btn = ev.target.closest('.q-sortb');
      if (!btn) return;
      const order = btn.dataset.order;
      queue.querySelectorAll('.q-sortb').forEach(b => {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });

      // Reorder inside each accordion section, never across them. The sections are the
      // editorial ranking (weak grade and unchecked is worse than merely unchecked) and
      // signals are triage; letting clicks lift an entry out of its tier would be the
      // opinion-moves-the-record failure this feature is designed to avoid.
      const groups = new Map();
      for (const row of rows) {
        const parent = row.parentNode;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(row);
      }
      for (const [parent, kids] of groups) {
        kids.sort((a, b) => (order === 'signals'
          // Descending by flags, then back to the server's order, so rows with equal
          // counts keep the evidence ordering instead of shuffling.
          ? (Number(b.dataset.signals) - Number(a.dataset.signals))
              || (Number(a.dataset.gap) - Number(b.dataset.gap))
          : Number(a.dataset.gap) - Number(b.dataset.gap)));
        kids.forEach(row => parent.appendChild(row));
      }
    });
  }

  fetch(url, { headers: { accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (!data) return;
      if (group) wireButtons((data.counts || {})[entryId] || {}, (data.mine || {})[entryId]);
      if (queue) wireQueue(data.counts || {});
    })
    // The API is not deployed on this host, or the database is down. Both surfaces stay
    // hidden and both pages remain exactly what they are without them.
    .catch(() => {});
})();
