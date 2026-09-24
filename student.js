import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore,doc,getDoc,collection,getDocs,query,where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig={
 apiKey:"AIzaSyDFzr3gxolAs5ydYfkb-Ui7H4xwDAHXFVU",
 authDomain:"kabartoo-school-system.firebaseapp.com",
 projectId:"kabartoo-school-system",
 storageBucket:"kabartoo-school-system.firebasestorage.app",
 messagingSenderId:"113746991114",
 appId:"1:113746991114:web:93a53ed0d68ac4eb1627f3",
 measurementId:"G-C2WJPCBHKW"
};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={user:null,profile:null,student:null,assignments:[],exams:[],schedules:[],attendance:[],grades:[],notifications:[]};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=v=>{if(!v)return "-";if(v?.toDate)v=v.toDate();const d=new Date(v);return isNaN(d)?"-":d.toLocaleDateString("ar-IQ")};
const toast=m=>{const e=$("#toast");e.textContent=m;e.style.display="block";setTimeout(()=>e.style.display="none",2500)};
const loginEmail=code=>`${String(code||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"")}@students.school.local`;
function showLogin(msg=""){
 $("#authOverlay").innerHTML=`<form class="login" id="loginForm"><div class="logo">S</div><h2>تسجيل دخول الطالب</h2><p>أدخل كود الطالب وكلمة المرور التي أنشأها المدير.</p>${msg?`<div class="error">${esc(msg)}</div>`:""}<label>كود الطالب<input id="code" autocomplete="username" placeholder="مثال: STU1001" required></label><label>كلمة المرور<input id="password" type="password" autocomplete="current-password" required></label><button>دخول إلى بوابة الطالب</button><p class="hint">إذا نسيت كلمة المرور، تواصل مع إدارة المدرسة.</p></form>`;
 $("#loginForm").onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;b.textContent="جارٍ الدخول...";try{await signInWithEmailAndPassword(auth,loginEmail($("#code").value),$("#password").value)}catch(err){b.disabled=false;showLogin(err.code==="auth/invalid-credential"?"الكود أو كلمة المرور غير صحيحة.":"تعذر تسجيل الدخول. تحقق من البيانات واتصال الإنترنت.")}};
}
function nav(id){$$(".section").forEach(x=>x.classList.toggle("active",x.id===id));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.section===id));$("#pageTitle").textContent={dashboard:"الرئيسية",assignments:"الواجبات",exams:"الامتحانات",schedule:"الجدول الأسبوعي",attendance:"غياباتي",grades:"درجاتي",notifications:"التنبيهات",profile:"ملفي الدراسي"}[id]||"بوابة الطالب";$("#sidebar").classList.remove("open")}
$$("[data-section]").forEach(x=>x.addEventListener("click",()=>nav(x.dataset.section)));$("#menu").onclick=()=>$("#sidebar").classList.toggle("open");$("#logout").onclick=()=>signOut(auth);
async function all(q){const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.deleted!==true)}
async function load(){
 const uid=state.user.uid;
 const ss=await getDocs(query(collection(db,"students"),where("authUid","==",uid)));
 if(ss.empty)throw Error("لم يتم العثور على ملف الطالب المرتبط بهذا الحساب.");
 state.student={id:ss.docs[0].id,...ss.docs[0].data()};
 const u=await getDoc(doc(db,"users",uid));state.profile=u.exists()?u.data():{};
 const classId=state.student.classId,sectionId=state.student.sectionId;
 const classSectionQuery=(name)=>sectionId
   ? query(collection(db,name),where("classId","==",classId),where("sectionId","==",sectionId))
   : query(collection(db,name),where("classId","==",classId));
 [state.assignments,state.exams,state.schedules,state.grades,state.attendance]=await Promise.all([
  all(classSectionQuery("assignments")),
  all(classSectionQuery("exams")),
  all(classSectionQuery("schedules")),
  all(query(collection(db,"grades"),where("studentId","==",state.student.id))),
  all(query(collection(db,"attendance"),where("studentId","==",state.student.id)))
 ]);
 state.schedules=state.schedules.filter(s=>s.recordType!=="meta");
 const noticeQueries=[
  query(collection(db,"announcements"),where("target","==","all")),
  query(collection(db,"announcements"),where("target","==","students")),
  query(collection(db,"announcements"),where("target","==","individual"),where("targetId","==",uid)),
  query(collection(db,"announcements"),where("target","==","class"),where("targetId","==",classId)),
  query(collection(db,"announcements"),where("target","==","section"),where("targetId","==",sectionId))
 ];
 const chunks=await Promise.all(noticeQueries.map(all));const seen=new Set();state.notifications=chunks.flat().filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true});
 render();
}
function render(){
 const s=state.student;
 $("#studentName").textContent=s.name||"الطالب";$("#classInfo").textContent=`${s.className||s.classId||"-"} / ${s.sectionName||s.sectionId||"-"}`;$("#today").textContent=new Date().toLocaleDateString("ar-IQ",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
 $("#schoolName").textContent=state.profile.schoolName||"مدرستي";
 const active=state.assignments.filter(a=>a.status!=="completed"),avg=state.grades.length?Math.round(state.grades.reduce((n,g)=>n+Number(g.value||0),0)/state.grades.length):null;
 $("#statAssignments").textContent=active.length;$("#statExams").textContent=state.exams.filter(e=>new Date(e.date)>=new Date(new Date().toISOString().slice(0,10))).length;$("#statAbsent").textContent=state.attendance.filter(a=>a.status==="absent").length;$("#statAverage").textContent=avg===null?"-":avg+"%";
 renderAssignments();renderExams();renderSchedule();renderAttendance();renderGrades();renderNotifications();renderProfile();
}
function renderAssignments(){const el=$("#assignmentsList");el.innerHTML=state.assignments.length?state.assignments.sort((a,b)=>String(a.dueDate||"").localeCompare(String(b.dueDate||""))).map(a=>`<article class="assignment"><h3>${esc(a.title||"واجب")}</h3><p>${esc(a.description||"لا يوجد وصف.")}</p><div class="meta">المادة: ${esc(a.subject||"-")} · التسليم: ${esc(a.dueDate||"-")} · المدرس: ${esc(a.teacherName||"-")}</div></article>`).join(""):`<div class="empty">لا توجد واجبات حالياً.</div>`;$("#latestNotifications").innerHTML=state.notifications.slice(0,3).map(n=>`<div class="notice"><b>${esc(n.title)}</b><div class="muted">${esc(n.body)}</div></div>`).join("")||'<div class="empty">لا توجد تنبيهات.</div>'}
function renderExams(){const rows=state.exams.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));$("#examsTable").innerHTML=rows.length?rows.map(e=>`<tr><td>${esc(e.subject)}</td><td>${esc(e.date)}</td><td>${esc(e.time||"-")}</td><td>${esc(e.room||"-")}</td></tr>`).join(""):`<tr><td colspan="4"><div class="empty">لا توجد امتحانات.</div></td></tr>`;$("#upcomingExams").innerHTML=rows.slice(0,3).map(e=>`<div class="notice"><b>${esc(e.subject)}</b><div class="muted">${esc(e.date)} · ${esc(e.time||"")} · ${esc(e.room||"")}</div></div>`).join("")||'<div class="empty">لا توجد امتحانات قادمة.</div>'}
function renderSchedule(){const rows=state.schedules.filter(x=>x.recordType!=="meta");const days=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"],map={};rows.forEach(x=>map[`${x.day}__${x.period}`]=x);let h='<table class="weekly"><thead><tr><th>الحصة</th>'+days.map(d=>`<th>${d}</th>`).join("")+'</tr></thead><tbody>';for(let p=1;p<=9;p++){h+=`<tr><th>${p}</th>`;for(const d of days){const x=map[`${d}__${p}`];h+=`<td><div class="cell">${x?`<strong>${esc(x.subject||"-")}</strong><small>${esc(x.teacherName||"")}</small>`:"-"}</div></td>`}h+="</tr>"}h+="</tbody></table>";$("#scheduleWrap").innerHTML=rows.length?h:'<div class="empty">لا يوجد جدول أسبوعي منشور.</div>'}
function renderAttendance(){const counts={present:0,absent:0,late:0,leave:0};state.attendance.forEach(a=>counts[a.status]=(counts[a.status]||0)+1);$("#pCount").textContent=counts.present;$("#aCount").textContent=counts.absent;$("#lCount").textContent=counts.late;$("#vCount").textContent=counts.leave;const label={present:["حاضر","present"],absent:["غائب","absent"],late:["متأخر","late"],leave:["إجازة","leave"]};$("#attendanceTable").innerHTML=state.attendance.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(a=>`<tr><td>${esc(a.date)}</td><td><span class="badge ${label[a.status]?.[1]||""}">${label[a.status]?.[0]||esc(a.status)}</span></td></tr>`).join("")||'<tr><td colspan="2"><div class="empty">لا يوجد سجل حضور.</div></td></tr>'}
function renderGrades(){const avg=state.grades.length?Math.round(state.grades.reduce((n,g)=>n+Number(g.value||0),0)/state.grades.length):0;$("#gradeSummary").innerHTML=`<h3>المتوسط العام المسجل: ${state.grades.length?avg+"%":"-"}</h3>`;$("#gradesTable").innerHTML=state.grades.map(g=>`<tr><td>${esc(g.subject)}</td><td>${esc(g.exam||"-")}</td><td><b>${esc(g.value)}</b></td><td>${fmt(g.createdAt)}</td></tr>`).join("")||'<tr><td colspan="4"><div class="empty">لا توجد درجات.</div></td></tr>'}
function renderNotifications(){const arr=state.notifications.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));$("#notificationsList").innerHTML=arr.length?arr.map(n=>`<article class="notice"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="meta">${esc(n.targetLabel||"المدرسة")}</div></article>`).join(""):'<div class="empty">لا توجد تنبيهات.</div>'}
function renderProfile(){const s=state.student;$("#profileCard").innerHTML=`<dl><div><dt>الاسم</dt><dd>${esc(s.name)}</dd></div><div><dt>كود الدخول</dt><dd>${esc(s.studentCode||"-")}</dd></div><div><dt>رقم الطالب</dt><dd>${esc(s.studentId||"-")}</dd></div><div><dt>الصف</dt><dd>${esc(s.className||"-")}</dd></div><div><dt>الشعبة</dt><dd>${esc(s.sectionName||"-")}</dd></div><div><dt>الهاتف</dt><dd>${esc(s.phone||"-")}</dd></div></dl>`}
onAuthStateChanged(auth,async user=>{
 if(!user){showLogin();return}
 try{state.user=user;await load();$("#authOverlay").style.display="none"}catch(e){console.error(e);$("#status").textContent="خطأ";showLogin(e.message)}
});
