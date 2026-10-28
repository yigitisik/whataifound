// Generated from js/entry.src.js by scripts/build-js.mjs. Edit that, then run scripts/build.py.
!function(){const t=(t,e)=>{const o=t.dataset.was||t.textContent
t.dataset.was=o,t.textContent=e,t.classList.add("done"),setTimeout(()=>{t.textContent=o,t.classList.remove("done")},1400)}
document.addEventListener("click",e=>{const o=e.target.closest("[data-copy]")
if(!o)return
const s=o.closest(".cite-block")?.querySelector(".cite-pre")
s&&window.wafCopy(s.textContent,s,()=>t(o,"Copied"),()=>t(o,"Selected, press copy"))})}()

