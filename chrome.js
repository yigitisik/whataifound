// The shared chrome: everything in the header that has to work on every page.
//
// This exists because the theme switcher used to live in app.js, and app.js loads only
// on the registry and visuals pages. The switcher was therefore missing from the
// methodology, review and contributors pages (which load no JavaScript at all), from all
// 52 finding pages, and from 404. The stored theme still applied everywhere, because the
// pre-paint initialiser is inlined in every page; there was simply no control to change
// it once you left the home page.
//
// Kept small on purpose, and separate from app.js for the same reason entry.js is: a
// finding page should not download 47 KB of filtering and chart code to run a theme
// button. Same-origin src, no inline handler: check-integrity.py rejects both of the
// alternatives, and the CSP allows neither.
(function () {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Theme: light / dark / system ----------
  const btns = [...document.querySelectorAll('.theme-seg .th')];
  if (btns.length) {
    // Default is dark: a first-time visitor (no stored choice) gets dark, not the OS setting.
    const current = () => { try { return localStorage.getItem('theme') || 'dark'; } catch (e) { return 'dark'; } };
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
      try { localStorage.setItem('theme', mode); } catch (e) {}
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
  }

  // ---------- Identity ----------
  // A deterministic avatar drawn from the handle, as inline SVG.
  //
  // Not a Google profile photo, and not for want of one: the CSP is `img-src 'self'
  // data:`, so a lh3.googleusercontent.com URL is blocked outright. That constraint
  // lands somewhere better than a compromise, because a page set in Newsreader with a
  // restrained palette should not carry forty unrelated JPEGs. The brand gradient is
  // the site's one accent, and this is the one place per page it appears twice.
  //
  // A 5x5 grid mirrored about the vertical axis, which is the classic identicon
  // construction: symmetry is what makes an arbitrary bit pattern read as a mark.
  function identicon(seed, size = 26) {
    // FNV-1a. Not for security, only to spread short similar handles apart: two
    // accounts called patient-lemma and patient-lemma-2 should not look alike.
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    let bits = h;
    const next = () => {
      // xorshift32 over the hash, so all 15 cells come from one seed deterministically.
      bits ^= bits << 13; bits >>>= 0;
      bits ^= bits >>> 17;
      bits ^= bits << 5;  bits >>>= 0;
      return bits;
    };
    const id = 'ic-' + (h >>> 0).toString(36);
    let cells = '';
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
        if (next() % 100 < 47) continue;
        // Mirror column 0 and 1 to 4 and 3; column 2 is the spine.
        for (const c of col === 2 ? [2] : [col, 4 - col]) {
          cells += `<rect x="${c}" y="${row}" width="1" height="1"/>`;
        }
      }
    }
    return `<svg class="idic" viewBox="0 0 5 5" width="${size}" height="${size}" aria-hidden="true">`
      + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">`
      + `<stop offset="0" stop-color="#5aa9e6"/><stop offset="0.5" stop-color="#7c6cf0"/>`
      + `<stop offset="1" stop-color="#d98a4a"/></linearGradient></defs>`
      + `<g fill="url(#${id})">${cells}</g></svg>`;
  }

  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Account control ----------
  // The header is pre-rendered signed-out. This swaps it once the session resolves,
  // which is the only correct order: build-site.py has no session to render, and
  // guessing one would mean a flash of the wrong state on every cold load.
  const slot = document.querySelector('[data-acct]');

  // Where to come back to after Google. Captured before the redirect so signing in
  // from a finding page returns to that finding page, not to the home page.
  const here = () => location.pathname + location.search + location.hash;

  const signInLink = slot && slot.querySelector('[data-signin]');
  if (signInLink) {
    signInLink.href = '/api/auth/start?return_to=' + encodeURIComponent(here());
  }

  function renderSignedIn(acct) {
    const name = acct.displayName || acct.handle;
    slot.innerHTML =
      `<details class="acct-menu">`
      + `<summary aria-label="Account">${identicon(acct.handle)}</summary>`
      + `<div class="acct-pop">`
      + `<p class="acct-who"><b>${esc(name)}</b><span>@${esc(acct.handle)}</span></p>`
      + `<a href="/account">Your account</a>`
      + `<button type="button" data-signout>Sign out</button>`
      + `</div></details>`;
    slot.querySelector('[data-signout]').addEventListener('click', async () => {
      try { await fetch('/api/auth/signout', { method: 'POST' }); } catch (e) {}
      location.reload();
    });
    // A details element stays open across a click outside it, which reads as broken
    // for a menu. Close it the way a menu closes.
    const menu = slot.querySelector('.acct-menu');
    document.addEventListener('click', ev => {
      if (menu.open && !menu.contains(ev.target)) menu.open = false;
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && menu.open) menu.open = false;
    });
  }

  // Exposed so /account can reuse the fetch rather than making a second one.
  const session = slot
    ? fetch('/api/me', { headers: { accept: 'application/json' } })
        .then(r => (r.ok ? r.json() : { signedIn: false }))
        .then(data => {
          if (data.signedIn) renderSignedIn(data.account);
          return data;
        })
        // Offline, or the API is not deployed on this host. The pre-rendered
        // signed-out control is already correct, so there is nothing to do and
        // nothing to report: the static site works without any of this.
        .catch(() => ({ signedIn: false }))
    : Promise.resolve({ signedIn: false });

  window.wafSession = session;
  window.wafIdenticon = identicon;

  // ---------- Citation year in the footer ----------
  // The footer is now on every page, so this moves here from app.js's bootData(), which
  // only ran on two of them. The printed year is the retrieval date of a citation, so it
  // is the one place on the site a real clock is correct: build-site.py deliberately has
  // no clock, and writes a static year that this replaces with today's date.
  const citeDate = document.getElementById('cite-date');
  if (citeDate) citeDate.textContent = new Date().toISOString().slice(0, 10);
})();
