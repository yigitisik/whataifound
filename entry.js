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
    const text = pre.textContent;
    // clipboard.writeText needs a secure context. On plain http (a local preview, or a
    // reader behind a proxy that strips TLS) it is simply absent, so fall back to
    // selecting the text: the reader still gets it with one keystroke rather than a
    // button that silently does nothing.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => label(btn, 'Copied'),
        () => selectFallback(pre, btn));
    } else {
      selectFallback(pre, btn);
    }
  });

  function selectFallback(pre, btn) {
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    label(btn, 'Selected, press copy');
  }
})();
