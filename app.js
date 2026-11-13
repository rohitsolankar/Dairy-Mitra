import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* OPTIONAL CLOUD SYNC:
   1) Create a Firebase project and enable Email/Password Authentication + Firestore.
   2) Paste your Firebase web app config below.
   3) Deploy this folder to HTTPS (e.g. Firebase Hosting / Vercel).
   Local-only mode works until Firebase is configured.
*/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const cloudEnabled = firebaseConfig.apiKey !== "YOUR_API_KEY";
let auth=null, db=null, currentUser=null, cloudReady=false;
if(cloudEnabled){try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);cloudReady=true;}catch(e){console.warn("Firebase setup:",e);}}

const $=id=>document.getElementById(id);
const STORAGE_KEY="solankarDairyData_v1";
const emptyData=()=>({dairyName:"Solankar Dairy",milk:[],feed:[]});
let data=loadLocal(), installPrompt=null;
function loadLocal(){try{return {...emptyData(),...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}}catch{return emptyData()}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));if(currentUser&&db)syncCloud();}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function money(v){return "₹"+Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
function litres(v){return Number(v||0).toFixed(2)+" L"}
function today(){return new Date().toISOString().slice(0,10)}
function dateObj(s){return new Date(s+"T00:00:00")}
function period(){const end=dateObj(today()),start=new Date(end);start.setDate(start.getDate()-14);return {start:start.toISOString().slice(0,10),end:today()}}
function inPeriod(d,p){return d>=p.start&&d<=p.end}
function sum(arr,fn){return arr.reduce((a,x)=>a+fn(x),0)}
function rateComplete(items){return items.length>0&&items.every(x=>x.rate!==null&&x.rate!==undefined)}
function sales(items){return sum(items,x=>x.rate==null?0:x.qty*x.rate)}
function feedComplete(items){return items.every(x=>x.price!==null&&x.price!==undefined)}
function setNames(){ $("brandName").textContent=data.dairyName;$("footerName").textContent=data.dairyName;document.title=data.dairyName+" | Smart Dairy Manager";}
function render(){
 setNames();const p=period(),m=data.milk.filter(x=>inPeriod(x.date,p)),f=data.feed.filter(x=>inPeriod(x.date,p));
 const todayMilk=data.milk.filter(x=>x.date===today()),tmQty=sum(todayMilk,x=>x.qty),tmSales=sales(todayMilk);
 $("todayLitres").textContent=litres(tmQty);$("todaySales").textContent=rateComplete(todayMilk)?money(tmSales):"—";
 $("periodLitres").textContent=litres(sum(m,x=>x.qty));
 const todayShift=s=>todayMilk.filter(x=>x.shift===s),mor=todayShift("Morning"),eve=todayShift("Evening");
 $("morningToday").textContent=litres(sum(mor,x=>x.qty));$("eveningToday").textContent=litres(sum(eve,x=>x.qty));
 $("morningTodaySale").textContent=mor.length&&rateComplete(mor)?"Sales: "+money(sales(mor)):"Sales: —";
 $("eveningTodaySale").textContent=eve.length&&rateComplete(eve)?"Sales: "+money(sales(eve)):"Sales: —";
 $("todayDateText").textContent=new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
 const morning=m.filter(x=>x.shift==="Morning"),evening=m.filter(x=>x.shift==="Evening");
 const milkKnown=rateComplete(m),feedKnown=feedComplete(f),salesTotal=sales(m),feedTotal=sum(f,x=>x.price??0);
 $("periodRange").textContent=fmt(p.start)+" – "+fmt(p.end);
 $("rMorningQty").textContent=litres(sum(morning,x=>x.qty));$("rEveningQty").textContent=litres(sum(evening,x=>x.qty));
 $("rMorningSale").textContent=morning.length&&rateComplete(morning)?"Sales: "+money(sales(morning)):"Sales: —";
 $("rEveningSale").textContent=evening.length&&rateComplete(evening)?"Sales: "+money(sales(evening)):"Sales: —";
 $("rTotalQty").textContent=litres(sum(m,x=>x.qty));$("rSales").textContent=milkKnown?money(salesTotal):"Incomplete";
 $("rUnknownRates").textContent=m.filter(x=>x.rate==null).length+" milk entries without rate";
 $("rFeed").textContent=feedKnown?money(feedTotal):money(feedTotal)+" + unknown";
 $("rUnknownFeed").textContent=f.filter(x=>x.price==null).length+" feed entries without price";
 $("rNet").textContent=milkKnown&&feedKnown?money(salesTotal-feedTotal):"Incomplete";
 $("periodNet").textContent=milkKnown&&feedKnown?money(salesTotal-feedTotal):"—";
 $("dailyBreakdown").innerHTML=buildDailyTable(p);
 $("recentFeed").innerHTML=recordHTML(data.feed.slice().sort(sortDate).slice(0,6),"feed");
 $("allRecords").innerHTML=allRecordHTML($("historySearch").value||"");
 $("recordCount").textContent=(data.milk.length+data.feed.length)+" records";
}
function fmt(s){return dateObj(s).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
function sortDate(a,b){return b.date.localeCompare(a.date)}
function buildDailyTable(p){let rows="";for(let i=0;i<15;i++){let d=new Date(dateObj(p.start));d.setDate(d.getDate()+i);let ds=d.toISOString().slice(0,10),items=data.milk.filter(x=>x.date===ds),am=items.filter(x=>x.shift==="Morning"),pm=items.filter(x=>x.shift==="Evening");rows+=`<tr><td>${fmt(ds)}</td><td>${litres(sum(am,x=>x.qty))}</td><td>${litres(sum(pm,x=>x.qty))}</td><td>${litres(sum(items,x=>x.qty))}</td><td>${items.length&&rateComplete(items)?money(sales(items)):"—"}</td></tr>`}return `<table class="dailytable"><thead><tr><th>Date</th><th>Morning</th><th>Evening</th><th>Total</th><th>Sales</th></tr></thead><tbody>${rows}</tbody></table>`}
function recordHTML(items,type){if(!items.length)return '<p class="hint">No feed records yet.</p>';return items.map(x=>`<div class="record"><div class="recordmain"><div class="recordtitle">${esc(x.name)}</div><div class="recordmeta">${fmt(x.date)} · Feed expense</div></div><div class="recordvalue">${x.price==null?"Price unknown":money(x.price)}<small>Feed</small></div><button class="delete" data-del="${x.id}" data-type="feed" aria-label="Delete feed record">×</button></div>`).join("")}
function allRecordHTML(q){let all=[...data.milk.map(x=>({...x,type:"milk"})),...data.feed.map(x=>({...x,type:"feed"}))].sort(sortDate).filter(x=>(x.date+" "+(x.shift||"")+" "+(x.name||"")).toLowerCase().includes(q.toLowerCase()));if(!all.length)return '<p class="hint">No matching records found.</p>';return all.map(x=>`<div class="record"><div class="recordmain"><div class="recordtitle">${x.type==="milk"?"🥛 "+x.shift+" milk":"🌾 "+esc(x.name)}</div><div class="recordmeta">${fmt(x.date)} · ${x.type==="milk"?litres(x.qty):"Feed expense"}</div></div><div class="recordvalue">${x.type==="milk"?(x.rate==null?"Rate unknown":money(x.qty*x.rate)):(x.price==null?"Price unknown":money(x.price))}<small>${x.type==="milk"?(x.rate==null?"No rate":money(x.rate)+"/L"):"Feed"}</small></div><button class="delete" data-del="${x.id}" data-type="${x.type}" aria-label="Delete record">×</button></div>`).join("")}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("milkDate").value=today();$("feedDate").value=today();
function updateCalc(){let q=Number($("milkQty").value),r=$("milkRate").value;$("entryTotal").textContent=r!==""&&q>0?money(q*Number(r)):"Rate not entered"}
$("milkQty").addEventListener("input",updateCalc);$("milkRate").addEventListener("input",updateCalc);
$("milkForm").addEventListener("submit",e=>{e.preventDefault();let qty=Number($("milkQty").value),rate=$("milkRate").value===""?null:Number($("milkRate").value);if(!(qty>0)||rate!==null&&rate<0)return toast("Enter a valid quantity and rate.");data.milk.push({id:crypto.randomUUID(),date:$("milkDate").value,shift:$("milkShift").value,qty,rate,createdAt:Date.now()});persist();e.target.reset();$("milkDate").value=today();updateCalc();render();toast("Milk entry saved.");});
$("feedForm").addEventListener("submit",e=>{e.preventDefault();let price=$("feedPrice").value===""?null:Number($("feedPrice").value);if(price!==null&&price<0)return toast("Enter a valid price.");data.feed.push({id:crypto.randomUUID(),date:$("feedDate").value,name:$("feedName").value.trim(),price,createdAt:Date.now()});persist();e.target.reset();$("feedDate").value=today();render();toast("Feed expense saved.");});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id===b.dataset.tab));}));
$("settingsBtn").onclick=()=>{$("dairyNameInput").value=data.dairyName;$("settingsDialog").showModal()};
$("saveSettings").onclick=e=>{e.preventDefault();data.dairyName=$("dairyNameInput").value.trim()||"My Dairy";persist();$("settingsDialog").close();render();toast("Dairy name updated.");};
$("accountBtn").onclick=()=>{$("accountDialog").showModal();updateAuthUI()};
$("signUp").onclick=async()=>{if(!cloudReady)return toast("Cloud sync setup is needed. See README.");try{await createUserWithEmailAndPassword(auth,$("authEmail").value,$("authPassword").value);toast("Account created.");}catch(e){toast(authError(e))}};
$("signIn").onclick=async()=>{if(!cloudReady)return toast("Cloud sync setup is needed. See README.");try{await signInWithEmailAndPassword(auth,$("authEmail").value,$("authPassword").value);toast("Signed in. Syncing records…");}catch(e){toast(authError(e))}};
$("signOut").onclick=async()=>{if(auth)await signOut(auth);toast("Signed out. Local data remains on this device.");};
function authError(e){return e.code==="auth/email-already-in-use"?"Email already registered. Sign in instead.":e.code==="auth/weak-password"?"Use a password with at least 6 characters.":e.code==="auth/invalid-credential"?"Email or password is incorrect.":e.message}
function updateAuthUI(){ $("signOut").hidden=!currentUser;$("authStatus").textContent=currentUser?"Signed in as "+currentUser.email+". Cloud sync is enabled.":"Not signed in. Local saving is active."}
if(auth)onAuthStateChanged(auth,async user=>{currentUser=user;updateAuthUI();if(user){await loadCloud();}});
async function syncCloud(){try{await setDoc(doc(db,"dairies",currentUser.uid),{data,updatedAt:Date.now()});}catch(e){console.error(e);toast("Cloud sync failed. Your local copy is still saved.");}}
async function loadCloud(){try{const snap=await getDoc(doc(db,"dairies",currentUser.uid));if(snap.exists()){const remote=snap.data().data||emptyData();if(data.milk.length+data.feed.length>0){const merged={dairyName:remote.dairyName||data.dairyName,milk:mergeById(remote.milk||[],data.milk),feed:mergeById(remote.feed||[],data.feed)};data=merged;}else data=remote;localStorage.setItem(STORAGE_KEY,JSON.stringify(data));await syncCloud();render();toast("Your dairy records are synced.");}else await syncCloud();}catch(e){console.error(e);toast("Could not load cloud records. Local records are safe.");}}
function mergeById(a,b){const map=new Map();[...a,...b].forEach(x=>map.set(x.id,x));return [...map.values()]}
document.addEventListener("click",e=>{let b=e.target.closest("[data-del]");if(!b)return;if(!confirm("Delete this selected record? Other records will remain saved."))return;let key=b.dataset.type==="milk"?"milk":"feed";data[key]=data[key].filter(x=>x.id!==b.dataset.del);persist();render();toast("Selected record deleted.");});
$("historySearch").addEventListener("input",render);
$("exportBackup").onclick=()=>download("solankar-dairy-backup.json",JSON.stringify(data,null,2),"application/json");
$("importBackup").onchange=async e=>{let file=e.target.files[0];if(!file)return;try{let imported=JSON.parse(await file.text());if(!Array.isArray(imported.milk)||!Array.isArray(imported.feed))throw Error();data={...emptyData(),...imported,milk:mergeById(data.milk,imported.milk),feed:mergeById(data.feed,imported.feed)};persist();render();toast("Backup imported and merged. Existing records kept.");}catch{toast("Invalid backup file.");}e.target.value="";};
function reportData(){let p=period(),m=data.milk.filter(x=>inPeriod(x.date,p)),f=data.feed.filter(x=>inPeriod(x.date,p));return {p,m,f,morning:m.filter(x=>x.shift==="Morning"),evening:m.filter(x=>x.shift==="Evening")}}
$("downloadCSV").onclick=()=>{let {p,m,f}=reportData(),rows=[["Type","Date","Shift / Feed name","Quantity (L)","Rate (₹)","Amount (₹)"],...m.map(x=>["Milk",x.date,x.shift,x.qty,x.rate??"",x.rate==null?"":x.qty*x.rate]),...f.map(x=>["Feed",x.date,x.name,"",x.price??"",x.price??""])];download("solankar-dairy-15-day-report.csv",rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n"),"text/csv");};
$("downloadReport").onclick=async()=>{if(!window.jspdf){await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");}if(!window.jspdf){toast("PDF library could not load. Please try again online.");return;}const {jsPDF}=window.jspdf,doc=new jsPDF(),{p,m,f,morning,evening}=reportData(),known=rateComplete(m),feedKnown=feedComplete(f),st=sales(m),ft=sum(f,x=>x.price??0);doc.setFontSize(18);doc.text(data.dairyName,14,18);doc.setFontSize(11);doc.text("15-day milk & feed report: "+p.start+" to "+p.end,14,27);doc.text("Morning: "+sum(morning,x=>x.qty).toFixed(2)+" L | Sales: "+(rateComplete(morning)?money(sales(morning)):"Incomplete"),14,39);doc.text("Evening: "+sum(evening,x=>x.qty).toFixed(2)+" L | Sales: "+(rateComplete(evening)?money(sales(evening)):"Incomplete"),14,47);doc.text("Total milk: "+sum(m,x=>x.qty).toFixed(2)+" L",14,55);doc.text("Milk sales: "+(known?money(st):"Incomplete (missing milk rates)"),14,63);doc.text("Feed expenses: "+(feedKnown?money(ft):money(ft)+" + unknown prices"),14,71);doc.text("Net profit: "+(known&&feedKnown?money(st-ft):"Incomplete"),14,79);let y=91;doc.setFontSize(9);doc.text("Date       Morning L    Evening L    Total L    Sales",14,y);y+=7;for(let i=0;i<15;i++){let d=new Date(dateObj(p.start));d.setDate(d.getDate()+i);let ds=d.toISOString().slice(0,10),it=m.filter(x=>x.date===ds),a=it.filter(x=>x.shift==="Morning"),b=it.filter(x=>x.shift==="Evening");doc.text(`${ds}    ${sum(a,x=>x.qty).toFixed(2)}          ${sum(b,x=>x.qty).toFixed(2)}          ${sum(it,x=>x.qty).toFixed(2)}       ${it.length&&rateComplete(it)?money(sales(it)):"—"}`,14,y);y+=6;}y+=7;doc.text("Feed entries:",14,y);y+=6;f.forEach(x=>{doc.text(`${x.date}   ${x.name}   ${x.price==null?"Price unknown":money(x.price)}`,14,y);y+=6;if(y>275){doc.addPage();y=18;}});doc.save("solankar-dairy-15-day-report.pdf");};
function loadScript(src){return new Promise(resolve=>{let s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=resolve;document.head.append(s)})}
function download(name,content,type){let a=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").hidden=false});
$("installBtn").onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").hidden=true};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
$("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
render();updateAuthUI();
