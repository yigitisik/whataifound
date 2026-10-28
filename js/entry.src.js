// The only script on a finding page.
//
// app.js is 47 KB of registry filtering and chart drawing, none of which a leaf page
// needs, so the copy buttons get their own file rather than pulling that in. Everything
// here is an enhancement: the citation text is rendered into the page by build-site.py
// and stays visible and selectable, so with JavaScript off a finding page behaves
// exactly as it did before this existed.
//
// Same-origin src, no inline handler: check-integrity.py rejects both of the
// alternatives, and the CSP allows neither.
(function () {
  const label = (btn, text) => {
    const was = btn.dataset.was || btn.textContent;
    btn.dataset.was = was;
    btn.textContent = text;
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = was; btn.classList.remove('done'); }, 1400);
  };

  document.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-copy]');
    if (!btn) return;
    const pre = btn.closest('.cite-block')?.querySelector('.cite-pre');
    if (!pre) return;
    // The copy itself, including the insecure-context fallback that selects the block,
    // lives in chrome.js: the home page needs the same thing for its permalinks, and one
    // of the two copies used to claim success when nothing had been copied.
    window.wafCopy(
      pre.textContent, pre,
      () => label(btn, 'Copied'),
      () => label(btn, 'Selected, press copy'));
  });
})();
