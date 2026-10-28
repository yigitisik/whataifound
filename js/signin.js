// Generated from js/signin.src.js by scripts/build-js.mjs. Edit that, then run scripts/build.py.
!function(){"use strict"
var t=document.querySelector("[data-provider]")
if(t){var r=new URLSearchParams(location.search).get("return_to")||""
if(r&&"/"===r.charAt(0)&&!/[\u0000-\u001f\u007f\\]/.test(r)){var e
try{e=new URL(r,location.origin)}catch(t){return}e.origin===location.origin&&"//"!==e.pathname.slice(0,2)&&(t.href="/api/auth/start?return_to="+encodeURIComponent(r))}}}()

