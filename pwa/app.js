const KEY={days:"operatoros.days.v1",mvd:"operatoros.mvd.v1",weekly:"operatoros.weekly.v1",kaizen:"operatoros.kaizen.v1"};
const el=(id)=>document.getElementById(id);
const todayISO=()=>{const d=new Date();return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())).toISOString().slice(0,10);};
const prettyDate=(iso)=>{const [y,m,dd]=iso.split("-").map(Number);const d=new Date(y,m-1,dd);return d.toLocaleDateString(undefined,{weekday:"short",year:"numeric",month:"short",day:"numeric"});};
const load=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const getDays=()=>load(KEY.days,{});
const setDays=(o)=>save(KEY.days,o);
const getWeekly=()=>load(KEY.weekly,{});
const setWeekly=(o)=>save(KEY.weekly,o);
const getKaizen=()=>load(KEY.kaizen,{});
const setKaizen=(o)=>save(KEY.kaizen,o);
const getMvd=()=>load(KEY.mvd,{});
const setMvd=(o)=>save(KEY.mvd,o);

function mondayOfWeek(iso){const [y,m,d]=iso.split("-").map(Number);const dt=new Date(y,m-1,d);const day=dt.getDay();const diff=(day===0?-6:1-day);dt.setDate(dt.getDate()+diff);
  const yyyy=dt.getFullYear(),mm=String(dt.getMonth()+1).padStart(2,"0"),dd=String(dt.getDate()).padStart(2,"0");return `${yyyy}-${mm}-${dd}`;}
function lastNDaysISO(n){const out=[];const now=new Date();for(let i=n-1;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);
  out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);}return out;}
function parseNum(v){if(v===""||v==null) return null;const n=Number(v);return Number.isFinite(n)?n:null;}

function dayEntryFromForm(){return {
  date:todayISO(),
  sleepHours:parseNum(el("sleepHours").value),
  stress:parseNum(el("stress").value),
  energy:parseNum(el("energy").value),
  movementMins:parseNum(el("movementMins").value),
  deepWorkBlocks:parseNum(el("deepWorkBlocks").value),
  closedLoops:parseNum(el("closedLoops").value),
  connections:parseNum(el("connections").value),
  homeReset:parseNum(el("homeReset").value),
  financialAction:el("financialAction").checked,
  top3:el("top3").value||"",
  notes:el("notes").value||"",
  updatedAt:new Date().toISOString()
};}

function fillFormFromDay(e){
  el("sleepHours").value=e.sleepHours??"";
  el("stress").value=e.stress??"";
  el("energy").value=e.energy??"";
  el("movementMins").value=e.movementMins??"";
  el("deepWorkBlocks").value=e.deepWorkBlocks??"";
  el("closedLoops").value=e.closedLoops??"";
  el("connections").value=e.connections??"";
  el("homeReset").value=e.homeReset??"";
  el("financialAction").checked=!!e.financialAction;
  el("top3").value=e.top3??"";
  el("notes").value=e.notes??"";
}
function clearForm(){el("dailyForm").reset(); el("financialAction").checked=false;}
function renderTodayLabel(){el("todayLabel").textContent=`Today: ${prettyDate(todayISO())}`;}

// Tabs
function setupTabs(){
  const tabs=[...document.querySelectorAll(".tab")];
  const panels={today:el("tab-today"),history:el("tab-history"),weekly:el("tab-weekly"),kaizen:el("tab-kaizen"),settings:el("tab-settings")};
  tabs.forEach(btn=>{
    btn.addEventListener("click",()=>{
      tabs.forEach(t=>t.classList.remove("active")); btn.classList.add("active");
      Object.values(panels).forEach(p=>p.classList.remove("active")); panels[btn.dataset.tab].classList.add("active");
      if(btn.dataset.tab==="history") renderHistory();
      if(btn.dataset.tab==="weekly") renderWeekly();
      if(btn.dataset.tab==="kaizen") renderKaizen();
    });
  });
}

let selectedISO=null;
function historyMeta(e){
  const parts=[];
  if(e.sleepHours!=null) parts.push(`sleep ${e.sleepHours}h`);
  if(e.deepWorkBlocks!=null) parts.push(`deep ${e.deepWorkBlocks}`);
  if(e.movementMins!=null) parts.push(`move ${e.movementMins}m`);
  if(e.closedLoops!=null) parts.push(`loops ${e.closedLoops}`);
  return parts.join(" · ");
}
function renderHistory(){
  const days=getDays();
  const q=(el("historySearch").value||"").toLowerCase().trim();
  const list=el("historyList"); list.innerHTML="";
  const keys=Object.keys(days).sort((a,b)=>b.localeCompare(a));
  const filtered=keys.filter(k=>{
    if(!q) return true;
    const e=days[k];
    return (e.top3||"").toLowerCase().includes(q)||(e.notes||"").toLowerCase().includes(q);
  });
  if(filtered.length===0){list.innerHTML=`<div class="muted">No entries found.</div>`; return;}
  filtered.forEach(iso=>{
    const entry=days[iso];
    const div=document.createElement("div");
    div.className="history-item";
    div.innerHTML=`<div><div class="history-date">${prettyDate(iso)}</div><div class="history-meta">${historyMeta(entry)||"—"}</div></div>
                   <div class="muted">${entry.financialAction?"💸":""}</div>`;
    div.addEventListener("click",()=>{
      selectedISO=iso;
      el("selectedDayLabel").textContent=prettyDate(iso);
      el("selectedDayView").textContent=JSON.stringify(entry,null,2);
    });
    list.appendChild(div);
  });
}

function sum(a){return a.reduce((x,y)=>x+y,0);}
function avg(a){return a.length?sum(a)/a.length:null;}

function renderLineChart(canvas,labels,values){
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="rgba(0,0,0,0.05)"; ctx.fillRect(0,0,w,h);
  const data=values.map(v=>v==null?null:Number(v)); const present=data.filter(v=>v!=null);
  if(!present.length){ctx.fillStyle="rgba(148,163,184,0.9)"; ctx.font="16px system-ui"; ctx.fillText("No data for last 7 days.",20,40); return;}
  const minV=Math.min(...present), maxV=Math.max(...present);
  const pad=28, x0=pad, y0=pad, x1=w-pad, y1=h-pad;
  ctx.strokeStyle="rgba(148,163,184,0.15)"; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=y0+(i*(y1-y0)/4); ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();}
  const xStep=(x1-x0)/(labels.length-1);
  const scale=(v)=>{if(maxV===minV) return (y0+y1)/2; const t=(v-minV)/(maxV-minV); return y1-t*(y1-y0);};
  ctx.strokeStyle="rgba(34,197,94,0.85)"; ctx.lineWidth=2;
  let started=false; ctx.beginPath();
  data.forEach((v,i)=>{const x=x0+i*xStep; if(v==null){started=false; return;} const y=scale(v); if(!started){ctx.moveTo(x,y); started=true;} else ctx.lineTo(x,y);});
  ctx.stroke();
  ctx.fillStyle="rgba(34,197,94,0.95)";
  data.forEach((v,i)=>{if(v==null) return; const x=x0+i*xStep, y=scale(v); ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();});
  ctx.fillStyle="rgba(148,163,184,0.9)"; ctx.font="12px system-ui";
  labels.forEach((lab,i)=>{const x=x0+i*xStep; if(i%2===0) ctx.fillText(lab,x-10,h-10);});
}

function renderWeekly(){
  const days=getDays();
  const last7=lastNDaysISO(7);
  const entries=last7.map(d=>days[d]||null);
  const sleepVals=entries.map(e=>e?.sleepHours??null).filter(v=>v!=null);
  const deepVals=entries.map(e=>e?.deepWorkBlocks??null).filter(v=>v!=null);
  const moveVals=entries.map(e=>e?.movementMins??null).filter(v=>v!=null);
  const loopVals=entries.map(e=>e?.closedLoops??null).filter(v=>v!=null);
  const connVals=entries.map(e=>e?.connections??null).filter(v=>v!=null);
  const finCount=entries.filter(e=>e?.financialAction).length;

  const sleepAvg=avg(sleepVals);
  el("wkSleepAvg").textContent=sleepAvg==null?"—":`${sleepAvg.toFixed(1)} h`;
  el("wkDeepWorkTotal").textContent=deepVals.length?`${sum(deepVals)}`:"—";
  el("wkMovementTotal").textContent=moveVals.length?`${sum(moveVals)} min`:"—";
  el("wkClosedLoopsTotal").textContent=loopVals.length?`${sum(loopVals)}`:"—";
  el("wkConnectionsTotal").textContent=connVals.length?`${sum(connVals)}`:"—";
  el("wkFinancialActions").textContent=`${finCount}`;

  const labels=last7.map(d=>d.slice(5));
  renderLineChart(el("sleepChart"),labels,last7.map(d=>days[d]?.sleepHours??null));
  renderLineChart(el("deepWorkChart"),labels,last7.map(d=>days[d]?.deepWorkBlocks??null));

  const wkKey=mondayOfWeek(todayISO());
  const weekly=getWeekly();
  const entry=weekly[wkKey];
  el("wkWins").value=entry?.wins??"";
  el("wkFriction").value=entry?.friction??"";
  el("wkKaizen").value=entry?.kaizen??"";
  el("weeklyStatus").textContent=`Week starts: ${prettyDate(wkKey)}`;
}
function saveWeeklyReview(){
  const wkKey=mondayOfWeek(todayISO());
  const weekly=getWeekly();
  weekly[wkKey]={weekStart:wkKey,wins:el("wkWins").value||"",friction:el("wkFriction").value||"",kaizen:el("wkKaizen").value||"",updatedAt:new Date().toISOString()};
  setWeekly(weekly);
  el("weeklyStatus").textContent="Saved.";
  setTimeout(()=>el("weeklyStatus").textContent=`Week starts: ${prettyDate(wkKey)}`,1200);
}

// Kaizen
function escapeHtml(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;").replaceAll("\n","<br/>");}
function renderKaizen(){
  const k=getKaizen(); const keys=Object.keys(k).sort((a,b)=>b.localeCompare(a));
  const list=el("kaizenList"); list.innerHTML="";
  if(!keys.length){list.innerHTML=`<div class="muted">No Kaizen entries yet.</div>`;}
  else keys.forEach(weekStart=>{
    const it=k[weekStart];
    const div=document.createElement("div");
    div.className="kaizen-item";
    div.innerHTML=`<h4>${prettyDate(weekStart)}</h4><div><strong>Change:</strong> ${escapeHtml(it.change||"—")}</div><div class="muted" style="margin-top:6px;"><strong>Effect:</strong> ${escapeHtml(it.effect||"—")}</div>`;
    list.appendChild(div);
  });
  el("kaizenWeekStart").value=mondayOfWeek(todayISO());
}
function saveKaizen(){
  const weekStart=el("kaizenWeekStart").value||mondayOfWeek(todayISO());
  const k=getKaizen();
  k[weekStart]={weekStart,change:el("kaizenChange").value||"",effect:el("kaizenEffect").value||"",updatedAt:new Date().toISOString()};
  setKaizen(k);
  el("kaizenStatus").textContent="Saved.";
  el("kaizenChange").value=""; el("kaizenEffect").value="";
  renderKaizen();
  setTimeout(()=>el("kaizenStatus").textContent="",1200);
}

// MVD
function loadMvdForToday(){
  const mvd=getMvd(); const entry=mvd[todayISO()]||{};
  document.querySelectorAll("[data-mvd]").forEach(cb=>{const key=cb.getAttribute("data-mvd"); cb.checked=!!entry[key];});
}
function saveMvdForToday(){
  const mvd=getMvd(); const iso=todayISO(); const entry={};
  document.querySelectorAll("[data-mvd]").forEach(cb=>{const key=cb.getAttribute("data-mvd"); entry[key]=cb.checked;});
  mvd[iso]=entry; setMvd(mvd);
  el("mvdStatus").textContent="Saved."; setTimeout(()=>el("mvdStatus").textContent="",1200);
}

// Export/import
function download(filename,text){
  const blob=new Blob([text],{type:"application/octet-stream"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function exportJSON(){
  const payload={exportedAt:new Date().toISOString(),version:1,days:getDays(),weekly:getWeekly(),kaizen:getKaizen(),mvd:getMvd()};
  download(`operatoros-backup-${todayISO()}.json`,JSON.stringify(payload,null,2));
}
function importJSON(){
  const file=el("importFile").files?.[0];
  if(!file) return alert("Choose a JSON backup file first.");
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const payload=JSON.parse(reader.result);
      if(payload.days) setDays(payload.days);
      if(payload.weekly) setWeekly(payload.weekly);
      if(payload.kaizen) setKaizen(payload.kaizen);
      if(payload.mvd) setMvd(payload.mvd);
      alert("Import complete."); boot();
    }catch(e){alert("Import failed: "+e.message);}
  };
  reader.readAsText(file);
}
function exportCSV(){
  const days=getDays();
  const keys=Object.keys(days).sort((a,b)=>a.localeCompare(b));
  const header=["date","sleepHours","stress","energy","movementMins","deepWorkBlocks","closedLoops","connections","homeReset","financialAction","top3","notes","updatedAt"];
  const rows=[header.join(",")];
  for(const iso of keys){
    const e=days[iso];
    const row=header.map(k=>{
      const v=e?.[k]; if(v==null) return "";
      const s=String(v).replaceAll('"','""'); return `"${s}"`;
    });
    rows.push(row.join(","));
  }
  download(`operatoros-days-${todayISO()}.csv`,rows.join("\n"));
}
function wipe(){
  if(!confirm("This will delete all OperatorOS data on this device. Continue?")) return;
  Object.values(KEY).forEach(k=>localStorage.removeItem(k));
  alert("Wiped."); boot();
}

// PWA install prompt
let deferredPrompt=null;
function setupInstall(){
  const installBtn=el("installBtn");
  window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault(); deferredPrompt=e; installBtn.hidden=false;});
  installBtn.addEventListener("click",async()=>{if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.hidden=true;});
}

function setupServiceWorker(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}

function boot(){
  renderTodayLabel();
  const days=getDays(); const iso=todayISO();
  if(days[iso]) fillFormFromDay(days[iso]); else clearForm();
  loadMvdForToday();
  el("saveBtn").onclick=()=>{
    const entry=dayEntryFromForm();
    const days2=getDays(); days2[entry.date]=entry; setDays(days2);
    el("saveStatus").textContent="Saved."; setTimeout(()=>el("saveStatus").textContent="",1200);
  };
  el("clearBtn").onclick=()=>{clearForm(); el("saveStatus").textContent="Cleared."; setTimeout(()=>el("saveStatus").textContent="",1200);};
  el("saveMvdBtn").onclick=saveMvdForToday;
  el("historySearch").oninput=renderHistory;
  el("loadSelectedToFormBtn").onclick=()=>{
    if(!selectedISO) return alert("Select a day first.");
    const entry=getDays()[selectedISO]; if(!entry) return alert("Entry not found.");
    document.querySelector('.tab[data-tab="today"]').click();
    fillFormFromDay(entry);
    el("saveStatus").textContent=`Loaded ${prettyDate(selectedISO)} into form (edit & save).`;
  };
  el("deleteSelectedBtn").onclick=()=>{
    if(!selectedISO) return alert("Select a day first.");
    if(!confirm(`Delete entry for ${prettyDate(selectedISO)}?`)) return;
    const d=getDays(); delete d[selectedISO]; setDays(d);
    selectedISO=null; el("selectedDayLabel").textContent="None selected"; el("selectedDayView").textContent="";
    renderHistory();
  };
  el("saveWeeklyBtn").onclick=saveWeeklyReview;
  el("saveKaizenBtn").onclick=saveKaizen;
  el("exportJsonBtn").onclick=exportJSON;
  el("importJsonBtn").onclick=importJSON;
  el("wipeBtn").onclick=wipe;
  el("exportCsvBtn").onclick=exportCSV;
  renderHistory(); renderWeekly(); renderKaizen();
}

setupTabs();
setupInstall();
setupServiceWorker();
boot();
