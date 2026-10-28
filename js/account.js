// Generated from js/account.src.js by scripts/build-js.mjs. Edit that, then run scripts/build.py.
!function(){if(!document.querySelector('[data-state="in"]'))return
const e=e=>document.querySelector(e),t=window.wafEsc,n=e=>window.wafShow(e,".acct-state")
function a(){document.querySelectorAll("[data-err]").forEach(e=>{e.hidden=!0,e.textContent=""})}function i(e,t){const n=document.querySelector(`[data-err="${e}"]`)||document.querySelector('[data-err="_"]')
n&&(n.textContent=t,n.hidden=!1)}const o={cancelled:"Sign-in was cancelled.",state:"That sign-in link expired. Please try again.",exchange:"Google could not complete the sign-in. Please try again.",claims:"Google returned something we could not verify. Please try again.",unverified:"That Google account has an unverified email address, so we cannot use it.",banned:"This account has been suspended. Write to us if you think that is wrong.",server:"Something broke on our side. Please try again."}
function d(){const t=new URLSearchParams(location.search).get("error")
if(!t)return
const n=e('[data-state="out"] .acct-signin')
if(!n)return
const a=document.createElement("p")
a.className="fld-err",a.textContent=o[t]||"Sign-in did not complete. Please try again.",n.insertBefore(a,n.querySelector("p")),history.replaceState(null,"","/account")}const{status:c,kind:r}=window.wafLabels
function s(n){const a=e("[data-contribs]"),i=e("[data-contribs-empty]")
if(!n.length)return a.innerHTML="",void(i.hidden=!1)
i.hidden=!0,a.innerHTML=n.map(e=>{const n=Object.hasOwn(c,e.status)?e.status:"pending",a=c[n],i=function(e){let n
try{n=new URL(String(e.prUrl||"")).href}catch{return""}return n.startsWith("https://github.com/yigitisik/whataifound/pull/")?`<a class="feed-src" href="${t(n)}" target="_blank" rel="noopener">PR #${t(e.prNumber)}</a>`:""}(e),o=e.entryId?`<a class="feed-title" href="/finding/${t(e.entryId)}" title="${t(e.title)}">${t(e.title)}</a>`:`<span class="feed-title" title="${t(e.title)}">${t(e.title)}</span>`,d=Object.hasOwn(r,e.kind)?r[e.kind]:""
return`<li class="feed-row"><span class="feed-meta"><time class="feed-date" datetime="${t(e.date)}">${t(e.date)}</time><span class="pill r r-${n}">${t(a)}</span></span>`+o+`<span class="feed-note">${t(d)}${d&&e.note?": ":""}`+`${t(e.note||"")}${i}</span></li>`}).join("")}function l(t){const a=t.account
e("[data-avatar]").innerHTML=window.wafIdenticon?window.wafIdenticon(a.handle,56):"",e("[data-name]").textContent=a.displayName||a.handle,e("[data-handle]").textContent=a.handle,e("[data-joined]").textContent=a.createdAt?"joined "+new Date(a.createdAt).toLocaleDateString(void 0,{year:"numeric",month:"long"}):"",e("[data-role]").textContent=a.role
const i={signals:0,...t.stats}
!function(t){const n=Math.min(t.checksAccepted/3,1),a=Math.min(t.entriesMerged/5,1),i=Math.max(n,a)
e("[data-meter-fill]").style.width=`${Math.round(100*i)}%`
const o=e("[data-meter]")
o.setAttribute("role","progressbar"),o.setAttribute("aria-valuemin","0"),o.setAttribute("aria-valuemax","100"),o.setAttribute("aria-valuenow",String(Math.round(100*i)))
const d=e("[data-meter-note]")
i>=1?d.textContent="You have met the bar. A maintainer reviews the track record before inviting you.":d.innerHTML=`<b>${t.checksAccepted}</b> of 3 accepted checks<span class="acct-or">or</span><b>${t.entriesMerged}</b> of 5 merged entries`}(i),function(t){document.querySelectorAll("[data-stat]").forEach(e=>{const n=Number(t[e.dataset.stat]||0)
e.dataset.target=String(n),e.textContent=String(n)})
const n=e("[data-rate]")
t.checksSubmitted>0?(n.textContent=`${t.checksAccepted} of ${t.checksSubmitted} checks you submitted were accepted.`,n.hidden=!1):n.hidden=!0}(i),s(t.contributions||[]),function(t){e("#f-handle").value=t.handle||"",e("#f-name").value=t.displayName||"",e("#f-orcid").value=t.orcid||"",e("#f-github").value=t.githubLogin||"",e("#f-public").checked=Boolean(t.isPublic),e("[data-pub-url]").textContent=`whataifound.org/u/${t.handle}`
const n=e("#f-handle")
t.canRenameAt&&(n.disabled=!0,n.closest(".fld").querySelector(".fld-help").textContent=`You changed your handle recently. You can change it again after ${t.canRenameAt.slice(0,10)}.`)}(a),n("in")}e("[data-settings]").addEventListener("submit",async t=>{t.preventDefault(),a()
const n=e("[data-save]")
n.disabled=!0
const o={displayName:e("#f-name").value,orcid:e("#f-orcid").value,githubLogin:e("#f-github").value,isPublic:e("#f-public").checked},d=e("#f-handle")
d.disabled||(o.handle=d.value)
try{const t=await fetch("/api/account",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}),n=await t.json().catch(()=>({}))
if(!t.ok){return void i({handle_invalid:"handle",handle_taken:"handle",handle_cooldown:"handle",display_too_long:"displayName",display_invalid:"displayName",orcid_invalid:"orcid",github_invalid:"githubLogin"}[n.error]||"_",n.message||"That could not be saved.")}const a=e("[data-saved]")
a.hidden=!1,setTimeout(()=>{a.hidden=!0},2e3),n.changed&&n.changed.includes("handle")&&location.reload()}catch{i("_","Could not reach the server. Check your connection and try again.")}finally{n.disabled=!1}}),e("[data-delete]").addEventListener("click",async()=>{if("DELETE"===prompt("This deletes your account immediately and cannot be undone.\n\nType DELETE to confirm.")){a()
try{if(!(await fetch("/api/account",{method:"DELETE"})).ok)return void i("delete","That did not work. Please try again.")
location.href="/"}catch{i("delete","Could not reach the server. Please try again.")}}});(window.wafSession||Promise.resolve({signedIn:!1})).then(t=>{if(t.signedIn)l(t)
else{const t=e("[data-signin-btn]")
t&&(t.href="/api/auth/start?return_to=%2Faccount"),n("out"),d()}}).catch(()=>{n("out"),d()})}()

