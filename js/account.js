// The account page. Runs only on /account, after chrome.js.
//
// Three states are pre-rendered in account.html and this shows one of them, rather than
// building the page from scratch: the signed-out state is then instant instead of a
// spinner that resolves into a sign-in button, and the whole page is still readable with
// the stylesheet off.
//
// Every write goes to /api/account on the same origin. There is no third-party SDK, no
// token in localStorage, and nothing here reads the session cookie, which is HttpOnly
// and invisible to script by design.
(function () {
  const root = document.querySelector('[data-state="in"]');
  if (!root) return;

  const $ = sel => document.querySelector(sel);
  // Shared from chrome.js, which loads first on every page. This page keeps its own
  // wrapper class because `.acct-state` also carries layout, so the selector is passed
  // in rather than the class being renamed to match the other pages.
  const esc = window.wafEsc;
  const show = which => window.wafShow(which, '.acct-state');

  // GOVERNANCE.md: "Three accepted independent checks, or five merged entries." Two
  // routes to the same role, so the meter shows whichever the person is closer to
  // rather than picking one and making the other look like no progress at all.
  const REVIEWER_CHECKS = 3;
  const REVIEWER_ENTRIES = 5;

  // ---------- error surfacing ----------
  function clearErrors() {
    document.querySelectorAll('[data-err]').forEach(el => { el.hidden = true; el.textContent = ''; });
  }
  function setError(field, message) {
    const el = document.querySelector(`[data-err="${field}"]`) || document.querySelector('[data-err="_"]');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  // A sign-in that failed comes back as /account?error=<code>. The code is never
  // rendered: it selects a sentence from this table, so a crafted query string cannot
  // put text of its own choosing on the page.
  const SIGNIN_ERRORS = {
    cancelled: 'Sign-in was cancelled.',
    state: 'That sign-in link expired. Please try again.',
    exchange: 'Google could not complete the sign-in. Please try again.',
    claims: 'Google returned something we could not verify. Please try again.',
    unverified: 'That Google account has an unverified email address, so we cannot use it.',
    banned: 'This account has been suspended. Write to us if you think that is wrong.',
    server: 'Something broke on our side. Please try again.',
  };

  function showSignInError() {
    const code = new URLSearchParams(location.search).get('error');
    if (!code) return;
    const box = $('[data-state="out"] .acct-signin');
    if (!box) return;
    const p = document.createElement('p');
    p.className = 'fld-err';
    p.textContent = SIGNIN_ERRORS[code] || 'Sign-in did not complete. Please try again.';
    box.insertBefore(p, box.querySelector('p'));
    // Drop the parameter so a reload does not replay the message.
    history.replaceState(null, '', '/account');
  }

  // ---------- render ----------
  function fillProgress(stats) {
    const byChecks = Math.min(stats.checksAccepted / REVIEWER_CHECKS, 1);
    const byEntries = Math.min(stats.entriesMerged / REVIEWER_ENTRIES, 1);
    const best = Math.max(byChecks, byEntries);
    $('[data-meter-fill]').style.width = `${Math.round(best * 100)}%`;
    const meter = $('[data-meter]');
    meter.setAttribute('role', 'progressbar');
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    meter.setAttribute('aria-valuenow', String(Math.round(best * 100)));

    const note = $('[data-meter-note]');
    if (best >= 1) {
      note.textContent = 'You have met the bar. A maintainer reviews the track record before inviting you.';
    } else {
      note.innerHTML = `<b>${stats.checksAccepted}</b> of ${REVIEWER_CHECKS} accepted checks`
        + `<span class="acct-or">or</span>`
        + `<b>${stats.entriesMerged}</b> of ${REVIEWER_ENTRIES} merged entries`;
    }
  }

  function fillStats(stats) {
    document.querySelectorAll('[data-stat]').forEach(el => {
      const v = Number(stats[el.dataset.stat] || 0);
      el.dataset.target = String(v);
      el.textContent = String(v);
    });
    const rate = $('[data-rate]');
    if (stats.checksSubmitted > 0) {
      rate.textContent = `${stats.checksAccepted} of ${stats.checksSubmitted} checks you submitted were accepted.`;
      rate.hidden = false;
    } else {
      rate.hidden = true;
    }
  }

  // What was submitted, and what happened to it. Shared with /admin through chrome.js so
  // a contributor and the maintainer deciding on their submission read the same words.
  // Both are looked up through Object.hasOwn rather than indexed directly: one of these
  // becomes part of a class name, and esc() escapes quotes and angle brackets but not
  // spaces.
  const { status: STATUS_LABEL, kind: KIND_LABEL } = window.wafLabels;

  // A pull request link, or null.
  //
  // esc() stops a value breaking out of the href attribute, but it does not stop the
  // value *being* a javascript: URL, and an escaped `javascript:alert(1)` in an href
  // still runs on click. This field is written by our own GitHub App today, so nothing
  // hostile can reach it; that is a property of code in another phase, which is exactly
  // the kind of assumption that stops being true without anyone noticing. Check the
  // scheme and the host at the point of use instead, where the risk actually is.
  const PR_PREFIX = 'https://github.com/yigitisik/whataifound/pull/';
  function prLink(row) {
    let href;
    try {
      // Compare the *parsed* href, not the raw string. A raw
      // .../pull/../../../evil passes startsWith and then resolves to
      // https://github.com/evil in the browser, so the check has to run on the same
      // value the browser will navigate to.
      href = new URL(String(row.prUrl || '')).href;
    } catch { return ''; }
    if (!href.startsWith(PR_PREFIX)) return '';
    // The prefix already pins scheme, host and path, so javascript:, data: and any
    // other origin are excluded by construction rather than by a denylist.
    return `<a class="feed-src" href="${esc(href)}" target="_blank" rel="noopener">`
      + `PR #${esc(row.prNumber)}</a>`;
  }

  function fillContributions(rows) {
    const list = $('[data-contribs]');
    const empty = $('[data-contribs-empty]');
    if (!rows.length) { list.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    // Same row shape as the activity feed on the home page, so a contribution reads the
    // same wherever it appears.
    list.innerHTML = rows.map(r => {
      // Only a known status becomes part of a class name. esc() escapes quotes and
      // angle brackets but not spaces, so an unconstrained value here could add classes
      // of its own choosing to the element.
      const status = Object.hasOwn(STATUS_LABEL, r.status) ? r.status : 'pending';
      const label = STATUS_LABEL[status];
      const link = prLink(r);
      // A proposal for a new entry has nothing to link to until it is merged, so the
      // title is plain text rather than a link to a page that would 404.
      const title = r.entryId
        ? `<a class="feed-title" href="/finding/${esc(r.entryId)}" title="${esc(r.title)}">${esc(r.title)}</a>`
        : `<span class="feed-title" title="${esc(r.title)}">${esc(r.title)}</span>`;
      const kind = Object.hasOwn(KIND_LABEL, r.kind) ? KIND_LABEL[r.kind] : '';
      return `<li class="feed-row">`
        + `<span class="feed-meta">`
        + `<time class="feed-date" datetime="${esc(r.date)}">${esc(r.date)}</time>`
        + `<span class="pill r r-${status}">${esc(label)}</span></span>`
        + title
        + `<span class="feed-note">${esc(kind)}${kind && r.note ? ': ' : ''}`
        + `${esc(r.note || '')}${link}</span>`
        + `</li>`;
    }).join('');
  }

  function fillForm(a) {
    $('#f-handle').value = a.handle || '';
    $('#f-name').value = a.displayName || '';
    $('#f-orcid').value = a.orcid || '';
    $('#f-github').value = a.githubLogin || '';
    $('#f-public').checked = Boolean(a.isPublic);

    const pub = $('[data-pub-url]');
    pub.textContent = `whataifound.org/u/${a.handle}`;

    // The rename cooldown is enforced by the API; disabling the field here just stops
    // someone typing a new handle only to be told they cannot have it yet.
    const h = $('#f-handle');
    if (a.canRenameAt) {
      h.disabled = true;
      h.closest('.fld').querySelector('.fld-help').textContent =
        `You changed your handle recently. You can change it again after ${a.canRenameAt.slice(0, 10)}.`;
    }
  }

  function render(data) {
    const a = data.account;
    $('[data-avatar]').innerHTML = window.wafIdenticon ? window.wafIdenticon(a.handle, 56) : '';
    $('[data-name]').textContent = a.displayName || a.handle;
    $('[data-handle]').textContent = a.handle;
    $('[data-joined]').textContent = a.createdAt
      ? 'joined ' + new Date(a.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      : '';
    $('[data-role]').textContent = a.role;

    const stats = { signals: 0, ...data.stats };
    fillProgress(stats);
    fillStats(stats);
    fillContributions(data.contributions || []);
    fillForm(a);
    show('in');
  }

  // ---------- save ----------
  $('[data-settings]').addEventListener('submit', async ev => {
    ev.preventDefault();
    clearErrors();
    const btn = $('[data-save]');
    btn.disabled = true;
    const body = {
      displayName: $('#f-name').value,
      orcid: $('#f-orcid').value,
      githubLogin: $('#f-github').value,
      isPublic: $('#f-public').checked,
    };
    // Only send the handle when it is actually editable and changed, so a normal save
    // never burns the 30-day rename window.
    const h = $('#f-handle');
    if (!h.disabled) body.handle = h.value;

    try {
      const r = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        const field = { handle_invalid: 'handle', handle_taken: 'handle', handle_cooldown: 'handle',
                        display_too_long: 'displayName', display_invalid: 'displayName',
                        orcid_invalid: 'orcid', github_invalid: 'githubLogin' }[out.error] || '_';
        setError(field, out.message || 'That could not be saved.');
        return;
      }
      const saved = $('[data-saved]');
      saved.hidden = false;
      setTimeout(() => { saved.hidden = true; }, 2000);
      // The header shows the handle and avatar, so a rename has to be reflected there
      // too. Refetching is cheaper to reason about than patching two places by hand.
      if (out.changed && out.changed.includes('handle')) location.reload();
    } catch {
      setError('_', 'Could not reach the server. Check your connection and try again.');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- delete ----------
  $('[data-delete]').addEventListener('click', async () => {
    // Deliberately a typed confirmation rather than a yes/no dialog: this is
    // irreversible and one stray click should not do it.
    const typed = prompt('This deletes your account immediately and cannot be undone.\n\nType DELETE to confirm.');
    if (typed !== 'DELETE') return;
    clearErrors();
    try {
      const r = await fetch('/api/account', { method: 'DELETE' });
      if (!r.ok) { setError('delete', 'That did not work. Please try again.'); return; }
      location.href = '/';
    } catch {
      setError('delete', 'Could not reach the server. Please try again.');
    }
  });

  // ---------- boot ----------
  // chrome.js already made the /api/me call for the header. Reuse it rather than
  // making a second identical request.
  const session = window.wafSession || Promise.resolve({ signedIn: false });
  session.then(data => {
    if (data.signedIn) {
      render(data);
    } else {
      const btn = $('[data-signin-btn]');
      if (btn) btn.href = '/api/auth/start?return_to=%2Faccount';
      show('out');
      showSignInError();
    }
  }).catch(() => { show('out'); showSignInError(); });
})();
