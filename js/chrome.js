// Generated from js/chrome.src.js by scripts/build-js.mjs. Edit that, then run scripts/build.py.
!function(){const e=matchMedia("(prefers-reduced-motion: reduce)").matches,t=[...document.querySelectorAll(".theme-seg .th")]
if(t.length){const n=()=>{try{return localStorage.getItem("theme")||"dark"}catch(e){return"dark"}},o=e=>t.forEach(t=>t.setAttribute("aria-pressed",t.dataset.mode===e?"true":"false")),a=e=>{const t=document.querySelector("meta[name=theme-color]")
if(!t)return
const n="light"===e||"system"===e&&matchMedia("(prefers-color-scheme: light)").matches
t.content=n?"#faf9f6":"#111310"},c=e=>{"system"===e?document.documentElement.removeAttribute("data-theme"):document.documentElement.setAttribute("data-theme",e),o(e),a(e)
try{localStorage.setItem("theme",e)}catch(e){}}
o(n()),t.forEach(t=>t.addEventListener("click",()=>{const n=t.dataset.mode
document.startViewTransition&&!e?document.startViewTransition(()=>c(n)).ready.then(()=>{document.documentElement.animate({clipPath:["inset(0 0 100% 0)","inset(0 0 0 0)"]},{duration:1e3,easing:"ease-in-out",pseudoElement:"::view-transition-new(root)"})}):c(n)})),matchMedia("(prefers-color-scheme: light)").addEventListener("change",()=>{"system"===n()&&a("system")})}function n(e,t=26){let n=2166136261
for(let t=0;t<e.length;t++)n^=e.charCodeAt(t),n=Math.imul(n,16777619)>>>0
let o=n
const a=()=>(o^=o<<13,o>>>=0,o^=o>>>17,o^=o<<5,o>>>=0,o),c="ic-"+(n>>>0).toString(36)
let r=""
for(let e=0;e<3;e++)for(let t=0;t<5;t++)if(!(a()%100<47))for(const n of 2===e?[2]:[e,4-e])r+=`<rect x="${n}" y="${t}" width="1" height="1"/>`
return`<svg class="idic" viewBox="0 0 5 5" width="${t}" height="${t}" aria-hidden="true"><defs><linearGradient id="${c}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5aa9e6"/><stop offset="0.5" stop-color="#7c6cf0"/><stop offset="1" stop-color="#d98a4a"/></linearGradient></defs><g fill="url(#${c})">${r}</g></svg>`}const o=e=>String(e??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[e]))
window.wafEsc=o,window.wafShow=(e,t=".c-state")=>{document.querySelectorAll(t).forEach(t=>{t.hidden=t.dataset.state!==e})},window.wafLabels={status:{pending:"Pending",pr_open:"PR open",merged:"Merged",rejected:"Not accepted",needs_info:"Needs info"},kind:{check:"Independent check",challenge:"Grade challenge",entry:"New entry",correction:"Correction"}},window.wafCopy=(e,t,n,o)=>{const a=()=>{if(t){const e=document.createRange()
e.selectNodeContents(t)
const n=getSelection()
n.removeAllRanges(),n.addRange(e)}o()}
if(!navigator.clipboard?.writeText)return a()
navigator.clipboard.writeText(e).then(n,a)},document.addEventListener("click",e=>{const t=e.target.closest(".vid-play")
if(!t)return
const n=t.closest(".vid")
if(!n)return
const o=encodeURIComponent(n.dataset.yt||""),a=document.createElement("div")
a.className="vid-frame",a.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${o}?autoplay=1"\n      title="YouTube video player" allow="autoplay; encrypted-media; picture-in-picture"\n      allowfullscreen loading="lazy"></iframe>`,n.replaceWith(a)})
const a=document.querySelector("[data-acct]"),c=/^\/signin(\.html)?\/?$/.test(location.pathname),r=a&&a.querySelector("[data-signin]")
r&&!c&&(r.href="/signin?return_to="+encodeURIComponent(location.pathname+location.search+location.hash))
const s=a?fetch("/api/me",{headers:{accept:"application/json"}}).then(e=>e.ok?e.json():{signedIn:!1}).then(e=>(e.signedIn&&function(e){const t=e.displayName||e.handle
a.innerHTML=`<details class="acct-menu"><summary aria-label="Account">${n(e.handle)}</summary><div class="acct-pop"><p class="acct-who"><b>${o(t)}</b><span>@${o(e.handle)}</span></p><a href="/account">Your account</a><button type="button" data-signout>Sign out</button></div></details>`,a.querySelector("[data-signout]").addEventListener("click",async()=>{try{await fetch("/api/auth/signout",{method:"POST"})}catch(e){}location.reload()})
const c=a.querySelector(".acct-menu")
document.addEventListener("click",e=>{c.open&&!c.contains(e.target)&&(c.open=!1)}),document.addEventListener("keydown",e=>{"Escape"===e.key&&c.open&&(c.open=!1)})}(e.account),e)).catch(()=>({signedIn:!1})):Promise.resolve({signedIn:!1})
window.wafSession=s,window.wafIdenticon=n,document.querySelectorAll("[data-identicon]").forEach(e=>{const t=Number(e.dataset.size)||72
e.innerHTML=n(e.dataset.identicon,t)})
const i=document.getElementById("cite-date")
i&&(i.textContent=(new Date).toISOString().slice(0,10))
const d=document.querySelector(".pagenav"),l=d&&d.querySelector('a[aria-current="page"]')
if(l&&d.querySelector(".pn-ink")){let e=null
const t=()=>{const t=e||l
d.style.setProperty("--pn-x",t.offsetLeft+.2*t.offsetWidth+"px"),d.style.setProperty("--pn-y",t.offsetTop+t.offsetHeight-4+"px"),d.style.setProperty("--pn-w",.6*t.offsetWidth+"px")},n=n=>{n&&n!==e&&(e=n,t())},o=()=>{e&&(e=null,t())}
t(),d.classList.add("has-ink"),requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add("ink-live"))),"ResizeObserver"in window&&new ResizeObserver(t).observe(d),d.addEventListener("pointerover",e=>{"mouse"===e.pointerType&&n(e.target.closest("a"))}),d.addEventListener("pointerleave",e=>{"mouse"===e.pointerType&&o()}),d.addEventListener("focusin",e=>n(e.target.closest("a"))),d.addEventListener("focusout",e=>{d.contains(e.relatedTarget)||o()})}}()

