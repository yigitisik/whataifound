// Generated from js/signals.src.js by scripts/build-js.mjs. Edit that, then run scripts/build.py.
!function(){const t=window.wafEsc,e=document.querySelector("[data-signals]"),n=document.querySelector("[data-qsort]")
if(!e&&!n)return
const a=e&&e.dataset.signals,s=a?`/api/signals?entry=${encodeURIComponent(a)}`:"/api/signals",o=t=>Object.values(t||{}).reduce((t,e)=>t+e,0)
function i(){let n=e.querySelector(".sig-signin")
if(n)return
n=document.createElement("p"),n.className="sig-signin"
const a=location.pathname+location.search+location.hash
n.innerHTML=`<a href="/api/auth/start?return_to=${t(encodeURIComponent(a))}">Sign in</a> to flag this. One account, one signal per kind.`,e.appendChild(n)}fetch(s,{headers:{accept:"application/json"}}).then(t=>t.ok?t.json():null).then(t=>{t&&(e&&function(t,n){const s=new Set(n||[]),o=[...e.querySelectorAll(".sig-b")],r=(t,e,n)=>{t.setAttribute("aria-pressed",n?"true":"false"),t.querySelector("[data-n]").textContent=e>0?String(e):""}
o.forEach(e=>r(e,(t||{})[e.dataset.kind]||0,s.has(e.dataset.kind))),e.hidden=!1
let c=null
e.addEventListener("click",async e=>{const n=e.target.closest(".sig-b")
if(!n||n.disabled)return
if(null===c){const t=await(window.wafSession||Promise.resolve({signedIn:!1}))
c=t.signedIn}if(!c)return void i()
const s=n.dataset.kind,o="true"===n.getAttribute("aria-pressed")
r(n,((t||{})[s]||0)+(o?-1:1),!o),n.disabled=!0
try{const e=await fetch("/api/signals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entryId:a,kind:s})}),d=await e.json().catch(()=>({}))
if(!e.ok)return r(n,(t||{})[s]||0,o),void(401===e.status&&(c=!1,i()))
t=d.counts||{},r(n,t[s]||0,d.on)}catch{r(n,(t||{})[s]||0,o)}finally{n.disabled=!1}})}((t.counts||{})[a]||{},(t.mine||{})[a]),n&&function(t){const e=[...document.querySelectorAll(".q-row[data-entry]")]
if(!e.length)return
e.forEach((t,e)=>{t.dataset.gap=String(e)})
let a=0
for(const n of e){const e=o(t[n.dataset.entry])
if(n.dataset.signals=String(e),!e)continue
a++
const s=n.querySelector("[data-sig]")
s&&(s.textContent=`${e} flag${1===e?"":"s"}`,s.hidden=!1)}a&&(n.hidden=!1,n.addEventListener("click",t=>{const a=t.target.closest(".q-sortb")
if(!a)return
const s=a.dataset.order
n.querySelectorAll(".q-sortb").forEach(t=>{t.setAttribute("aria-pressed",t===a?"true":"false")})
const o=new Map
for(const t of e){const e=t.parentNode
o.has(e)||o.set(e,[]),o.get(e).push(t)}for(const[t,e]of o)e.sort((t,e)=>"signals"===s&&Number(e.dataset.signals)-Number(t.dataset.signals)||Number(t.dataset.gap)-Number(e.dataset.gap)),e.forEach(e=>t.appendChild(e))}))}(t.counts||{}))}).catch(()=>{})}()

