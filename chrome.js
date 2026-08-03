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

  // ---------- Citation year in the footer ----------
  // The footer is now on every page, so this moves here from app.js's bootData(), which
  // only ran on two of them. The printed year is the retrieval date of a citation, so it
  // is the one place on the site a real clock is correct: build-site.py deliberately has
  // no clock, and writes a static year that this replaces with today's date.
  const citeDate = document.getElementById('cite-date');
  if (citeDate) citeDate.textContent = new Date().toISOString().slice(0, 10);
})();
