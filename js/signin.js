// /signin: carry the return address one hop further.
//
// The header control links here rather than straight to Google, so the page the reader
// came from arrives as ?return_to=... and has to be handed to /api/auth/start, which is
// what actually round-trips it through the OAuth state cookie. Without this, signing in
// from a finding page would land back on the home page.
//
// The href in the markup is already a working sign-in link on its own. This only ever
// adds the return address, so a reader with no JavaScript still gets in; they just come
// back to "/". Same argument the rest of the site makes about pre-rendering.
(function () {
  "use strict";

  var btn = document.querySelector("[data-provider]");
  if (!btn) return;

  var rt = new URLSearchParams(location.search).get("return_to") || "";

  // Same rule api/_lib/http.js safeReturnTo() enforces, applied here as well. The server
  // is the one that counts and it re-checks this; doing it here too means a crafted URL
  // never even renders as a link that points off-site, which is the part a reader would
  // see and trust before any redirect happens.
  if (!rt || rt.charAt(0) !== "/" || rt.slice(0, 2) === "//" || rt.slice(0, 2) === "/\\") {
    return;
  }

  btn.href = "/api/auth/start?return_to=" + encodeURIComponent(rt);
})();
