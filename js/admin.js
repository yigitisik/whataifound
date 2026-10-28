// Generated from js/admin.src.js by scripts/build-js.mjs. Edit that, then run scripts/build.py.
!function(){const e=e=>document.querySelector(e),t=window.wafEsc,a=window.wafShow,n=e("[data-queue]")
if(!n)return
const{kind:r,status:d}=window.wafLabels,s={check:[["who","Checked by"],["outcome","Outcome"],["url","Link"],["evidence","What they checked"],["coi","Conflicts"]],challenge:[["axis","Axis"],["proposed","Proposed"],["citation","Citation"],["why","Argument"]],correction:[["target","What"],["year","Year"],["url","Link"],["label","Label"],["sourceKind","Source kind"],["note","Note"]],entry:[["id","Id"],["title","Title"],["claim","Claim"],["verification","Verification"],["autonomy","Autonomy"],["field","Field"],["date","Date"],["lab","Lab"],["model","Model"],["novelty_check","Novelty check"],["detail","Detail"],["caveats","Caveats"]]}
function o(e){let a
try{a=new URL(String(e))}catch{return t(e)}return"https:"!==a.protocol&&"http:"!==a.protocol?t(e):`<a href="${t(a.href)}" target="_blank" rel="noopener noreferrer">${t(a.href)}</a>`}function i(e){const a=e.author||{},n=a.handle?`@${t(a.handle)}`:"unknown",i=a.displayName?` <span class="ad-name">${t(a.displayName)}</span>`:"",c=a.submitted?`${a.merged} of ${a.submitted} merged`:"first submission",l=Object.hasOwn(d,e.status)?e.status:"pending",p=Object.hasOwn(r,e.kind)?e.kind:"check",u=String(e.createdAt||"").slice(0,10),h=e.entryId?`<a href="/finding/${t(e.entryId)}" target="_blank" rel="noopener">${t(e.entryId)}</a>`:'<span class="ad-new">new entry</span>',f="pr_open"===e.status&&e.prUrl?`<p class="ad-pr">Pull request open:\n         <a href="${t(new URL(e.prUrl,"https://github.com").href)}" target="_blank"\n            rel="noopener">#${t(e.prNumber)}</a>. Merge it there when you are satisfied.</p>`:""
return`<article class="ad-card" data-id="${t(e.id)}">\n      <header class="ad-head">\n        <span class="pill r r-${t(l)}">${t(d[l])}</span>\n        <span class="ad-kind">${t(r[p])}</span>\n        <span class="ad-entry">${h}</span>\n        <time class="ad-when">${t(u)}</time>\n      </header>\n      <p class="ad-who">${n}${i}\n        <span class="ad-record">${t(c)}</span>\n        ${a.orcid?`<a class="credit-orcid" href="https://orcid.org/${t(a.orcid)}"\n           target="_blank" rel="noopener"\n           title="ORCID ${t(a.orcid)}, self-reported: confirm it before merging">iD</a>`:""}\n      </p>\n      <dl class="ad-fields">${function(e,a){return(Object.hasOwn(s,e)?s[e]:[]).map(([e,n])=>{const r=a&&a[e]
if(null==r||""===r)return""
const d=/^https?:\/\//i.test(String(r))?o(r):t(r)
return`<div class="ad-f"><dt>${t(n)}</dt><dd>${d}</dd></div>`}).join("")}(p,e.payload)}${b=e.payload,Array.isArray(b?.sources)?'<div class="ad-f"><dt>Sources</dt><dd><ul class="ad-src">'+b.sources.map(e=>`<li><span class="pill k k-${t(e.kind)}">${t(e.kind)}</span> ${o(e.url)} <span class="ad-slabel">${t(e.label)}</span></li>`).join("")+"</ul></dd></div>":""}</dl>\n      ${f}\n      <div class="ad-act">\n        <textarea class="ad-note" rows="2" data-note\n          placeholder="Why. Shown to the submitter, and required to reject or ask for more."></textarea>\n        <div class="ad-btns">\n          <button type="button" class="btn primary" data-decide="approve"\n            ${"pr_open"===e.status?"disabled":""}>Approve and open PR</button>\n          <button type="button" class="btn" data-decide="needs_info">Ask for more</button>\n          <button type="button" class="btn ad-no" data-decide="reject">Reject</button>\n        </div>\n        <p class="fld-err" data-err hidden></p>\n      </div>\n    </article>`
var b}async function c(){try{const t=await fetch("/api/admin/proposals",{headers:{accept:"application/json"}})
if(401===t.status||404===t.status)return void a("out")
if(!t.ok)throw new Error("load")
const r=await t.json()
e("[data-nogithub]").hidden=!1!==r.github
const d=r.proposals||[]
e("[data-count]").textContent=String(d.length),n.innerHTML=d.map(i).join(""),e("[data-empty]").hidden=d.length>0,a("in")}catch{a("out")}}n.addEventListener("click",async e=>{const t=e.target.closest("[data-decide]")
if(!t)return
const a=t.closest(".ad-card"),n=a.querySelector("[data-err]")
n.hidden=!0
const r=t.dataset.decide,d=a.querySelector("[data-note]").value.trim()
if("approve"!==r||confirm("Open a pull request for this submission?\n\nIt still has to be merged by hand.")){a.querySelectorAll("[data-decide]").forEach(e=>{e.disabled=!0})
try{const e=await fetch("/api/admin/proposals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.dataset.id,decision:r,note:d})}),t=await e.json().catch(()=>({}))
if(!e.ok)return n.textContent=t.message||"That did not work.",n.hidden=!1,void a.querySelectorAll("[data-decide]").forEach(e=>{e.disabled=!1})
c()}catch{n.textContent="Could not reach the server.",n.hidden=!1,a.querySelectorAll("[data-decide]").forEach(e=>{e.disabled=!1})}}}),e("[data-refresh]").addEventListener("click",c);(window.wafSession||Promise.resolve({signedIn:!1})).then(t=>{if(!t.signedIn){const t=e("[data-signin-btn]")
return t&&(t.href="/api/auth/start?return_to=%2Fadmin"),void a("out")}c()}).catch(()=>a("out"))}()

