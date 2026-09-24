import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFzr3gxolAs5ydYfkb-Ui7H4xwDAHXFVU",
  authDomain: "kabartoo-school-system.firebaseapp.com",
  projectId: "kabartoo-school-system",
  storageBucket: "kabartoo-school-system.firebasestorage.app",
  messagingSenderId: "113746991114",
  appId: "1:113746991114:web:93a53ed0d68ac4eb1627f3",
  measurementId: "G-C2WJPCBHKW"
};

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={user:null,profile:null,teacher:null,assignments:[],students:[],grades:[],attendance:[],exams:[],schedules:[],homework:[],announcements:[],classes:[]};
const today=()=>new Date().toISOString().slice(0,10);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=v=>{if(!v)return "-";if(v?.toDate)v=v.toDate();const d=new Date(v);return isNaN(d)?"-":d.toLocaleDateString("ar-IQ")};
function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2500)}
function nav(s){$$(".page-section").forEach(x=>x.classList.toggle("active",x.id===s));$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.section===s));$("#pageTitle").textContent={dashboard:"لوحة المدرس",assignments:"تكليفاتي",students:"طلابي",grades:"الدرجات",attendance:"الحضور",exams:"الامتحانات",schedule:"جدولي الأسبوعي",homework:"الواجبات",announcements:"التنبيهات"}[s];$("#sidebar").classList.remove("open")}
$$("[data-section]").forEach(b=>b.onclick=()=>nav(b.dataset.section));
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#logoutBtn").onclick=()=>signOut(auth);

async function all(name){const s=await getDocs(collection(db,name));return s.docs.map(d=>({id:d.id,...d.data()}))}
async function load(){
  [state.assignments,state.students,state.grades,state.attendance,state.exams,state.schedules,state.homework,state.announcements,state.classes]=await Promise.all(["teachingAssignments","students","grades","attendance","exams","schedules","assignments","announcements","classes"].map(all));
  state.assignments=state.assignments.filter(a=>a.teacherId===state.user.uid||a.teacherUid===state.user.uid||a.teacherId===state.teacher?.id);
  const classIds=new Set(state.assignments.map(a=>a.classId).filter(Boolean));
  state.students=state.students.filter(s=>classIds.has(s.classId)&&s.status!=="expelled");
  const myClassIds=new Set([...classIds]);
  state.grades=state.grades.filter(g=>state.students.some(s=>s.id===g.studentId)&&(g.teacherId===state.user.uid||!g.teacherId));
  state.attendance=state.attendance.filter(a=>state.students.some(s=>s.id===a.studentId));
  state.exams=state.exams.filter(e=>myClassIds.has(e.classId));
  state.schedules=state.schedules.filter(s=>s.teacherId===state.user.uid||s.teacherId===state.teacher?.id);
  state.homework=state.homework.filter(h=>h.teacherId===state.user.uid||h.teacherUid===state.user.uid);
  state.announcements=state.announcements.filter(a=>a.target==="all"||a.target==="teachers"||a.targetId===state.user.uid||classIds.has(a.targetId));
  render();
}
function assignmentLabel(a){return `${a.subject||a.subjectName||"مادة"} — ${a.className||a.classId||"صف"} / ${a.sectionName||a.classSection||a.sectionId||"شعبة"}`}
function renderAssignments(target="#assignmentsList"){
  const html=state.assignments.length?state.assignments.map(a=>`<article class="assignment-card"><h3>${esc(a.subject||"مادة")}</h3><p>${esc(a.className||a.classId||"-")} / ${esc(a.sectionName||a.classSection||a.sectionId||"-")}</p><span class="tag">تكليف تدريسي</span><span class="tag">${state.students.filter(s=>s.classId===a.classId).length} طالب</span></article>`).join(""):`<div class="empty">لا توجد تكليفات مرتبطة بحسابك.</div>`;$(target).innerHTML=html}
function renderStudents(){const q=($("#studentSearch").value||"").toLowerCase(),f=$("#studentAssignmentFilter").value;const a=state.assignments.find(x=>x.id===f);const rows=state.students.filter(s=>(!a||s.classId===a.classId)).filter(s=>`${s.name||""} ${s.studentId||""}`.toLowerCase().includes(q));$("#studentsTable").innerHTML=rows.length?rows.map(s=>`<tr><td>${esc(s.studentId||s.id)}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.className||s.classId)}</td><td>${esc(s.sectionName||s.sectionId)}</td><td><span class="badge active">نشط</span></td></tr>`).join(""):`<tr><td colspan="5" class="empty">لا توجد نتائج.</td></tr>`}
function renderGrades(){const q=($("#gradeSearch").value||"").toLowerCase();const rows=state.grades.filter(g=>`${g.studentName||""} ${g.subject||""}`.toLowerCase().includes(q));$("#gradesTable").innerHTML=rows.length?rows.map(g=>`<tr><td>${esc(g.studentName||g.studentId)}</td><td>${esc(g.subject)}</td><td>${esc(g.exam)}</td><td><strong>${esc(g.value)}</strong></td><td>${fmt(g.createdAt)}</td><td><button class="small-btn" onclick="editGrade('${g.id}')">تعديل</button></td></tr>`).join(""):`<tr><td colspan="6" class="empty">لا توجد درجات.</td></tr>`}
function renderAttendance(){const date=$("#attendanceDate").value||today(),aid=$("#attendanceAssignmentFilter").value,a=state.assignments.find(x=>x.id===aid);const students=state.students.filter(s=>!a||s.classId===a.classId);const rows=students.map(s=>{const old=state.attendance.find(x=>x.studentId===s.id&&x.date===date);const st=old?.status||"present";return `<tr><td>${esc(s.name)}</td><td>${esc(s.className||s.classId)}</td><td>${esc(s.sectionName||s.sectionId)}</td><td><select id="att-${s.id}"><option value="present" ${st==="present"?"selected":""}>حاضر</option><option value="absent" ${st==="absent"?"selected":""}>غائب</option><option value="late" ${st==="late"?"selected":""}>متأخر</option><option value="leave" ${st==="leave"?"selected":""}>إجازة</option></select></td><td><button class="small-btn" onclick="saveAttendance('${s.id}','${old?.id||""}')">حفظ</button></td></tr>`}).join("");$("#attendanceTable").innerHTML=rows||`<tr><td colspan="5" class="empty">لا يوجد طلاب.</td></tr>`}
function render(){renderAssignments("#assignmentCards");renderAssignments();renderStudents();renderGrades();renderAttendance();$("#examsTable").innerHTML=state.exams.length?state.exams.map(e=>`<tr><td>${esc(e.subject)}</td><td>${esc(e.className||e.classId)} / ${esc(e.sectionName||e.sectionId)}</td><td>${esc(e.date)}</td><td>${esc(e.time)}</td><td>${esc(e.room)}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">لا توجد امتحانات.</td></tr>`;$("#scheduleTable").innerHTML=state.schedules.length?state.schedules.map(s=>`<tr><td>${esc(s.day)}</td><td>${esc(s.period)}</td><td>${esc(s.className||s.classId)} / ${esc(s.sectionName||s.sectionId)}</td><td>${esc(s.subject)}</td></tr>`).join(""):`<tr><td colspan="4" class="empty">لا توجد حصص.</td></tr>`;$("#homeworkList").innerHTML=state.homework.length?state.homework.map(h=>`<article class="homework-card"><h3>${esc(h.title)}</h3><p>${esc(h.description)}</p><span class="tag">${esc(h.subject)}</span><span class="tag">${esc(h.className||"")}/${esc(h.sectionName||"")}</span><p>التسليم: ${esc(h.dueDate||"-")}</p></article>`).join(""):`<div class="empty">لم تنشئ واجبات بعد.</div>`;const notes=state.announcements.slice(0,20);$("#announcementsList").innerHTML=notes.length?notes.map(a=>`<div class="activity-item"><strong>${esc(a.title)}</strong><small>${esc(a.body)}</small></div>`).join(""):`<div class="empty">لا توجد تنبيهات.</div>`;$("#latestAnnouncements").innerHTML=notes.slice(0,4).map(a=>`<div class="activity-item"><strong>${esc(a.title)}</strong><small>${esc(a.body)}</small></div>`).join("")||`<div class="empty">لا توجد تنبيهات.</div>`;$("#statAssignments").textContent=state.assignments.length;$("#statStudents").textContent=state.students.length;$("#statHomework").textContent=state.homework.length;const a=state.attendance.filter(x=>x.date===today());$("#statPresent").textContent=a.filter(x=>x.status==="present").length;$("#statAbsent").textContent=a.filter(x=>x.status==="absent").length;$("#sumPresent").textContent=a.filter(x=>x.status==="present").length;$("#sumAbsent").textContent=a.filter(x=>x.status==="absent").length;$("#sumLate").textContent=a.filter(x=>x.status==="late").length;$("#sumLeave").textContent=a.filter(x=>x.status==="leave").length}
function setupFilters(){const opts=state.assignments.map(a=>`<option value="${a.id}">${esc(assignmentLabel(a))}</option>`).join("");$("#studentAssignmentFilter").innerHTML=`<option value="">كل التكليفات</option>${opts}`;$("#attendanceAssignmentFilter").innerHTML=`<option value="">كل التكليفات</option>${opts}`}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.add("open")}function closeModal(){$("#modal").classList.remove("open");$("#modalContent").innerHTML=""}$("#modalClose").onclick=closeModal;$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};

$("#addGradeBtn").onclick=()=>{const opts=state.students.map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.studentId||s.id)}</option>`).join(""),subs=[...new Set(state.assignments.map(a=>a.subject))].map(x=>`<option>${esc(x)}</option>`).join("");openModal(`<h2>إدخال درجة</h2><div class="form-grid"><label>الطالب<select id="gStudent">${opts}</select></label><label>المادة<select id="gSubject">${subs}</select></label><label>الامتحان<input id="gExam" placeholder="نصف السنة"></label><label>الدرجة<input id="gValue" type="number" min="0" max="100"></label><button class="primary" id="saveGrade">حفظ</button></div>`);$("#saveGrade").onclick=async()=>{const s=state.students.find(x=>x.id===$("#gStudent").value),subject=$("#gSubject").value,value=Number($("#gValue").value);if(!s||!subject||Number.isNaN(value))return toast("أكمل البيانات");await addDoc(collection(db,"grades"),{studentId:s.id,studentName:s.name,subject,exam:$("#gExam").value.trim(),value,teacherId:state.user.uid,createdAt:serverTimestamp()});closeModal();toast("تم حفظ الدرجة");await load()}}
window.editGrade=async id=>{const g=state.grades.find(x=>x.id===id);openModal(`<h2>تعديل الدرجة</h2><div class="form-grid"><label>الدرجة<input id="egValue" type="number" min="0" max="100" value="${esc(g.value)}"></label><button class="primary" id="egSave">حفظ</button></div>`);$("#egSave").onclick=async()=>{await updateDoc(doc(db,"grades",id),{value:Number($("#egValue").value),updatedAt:serverTimestamp()});closeModal();toast("تم تعديل الدرجة");await load()}};
window.saveAttendance=async(studentId,aid)=>{const s=state.students.find(x=>x.id===studentId),data={studentId,studentName:s.name,date:$("#attendanceDate").value,status:$(`#att-${studentId}`).value,classId:s.classId,sectionId:s.sectionId,teacherId:state.user.uid,updatedAt:serverTimestamp()};if(aid)await updateDoc(doc(db,"attendance",aid),data);else await addDoc(collection(db,"attendance"),{...data,createdAt:serverTimestamp()});toast("تم حفظ الحضور");await load()};
$("#loadAttendanceBtn").onclick=renderAttendance;
$("#attendanceDate").value=today();$("#attendanceAssignmentFilter").onchange=renderAttendance;$("#studentSearch").oninput=renderStudents;$("#studentAssignmentFilter").onchange=renderStudents;$("#gradeSearch").oninput=renderGrades;

$("#addHomeworkBtn").onclick=()=>{const opts=state.assignments.map(a=>`<option value="${a.id}">${esc(assignmentLabel(a))}</option>`).join("");openModal(`<h2>إضافة واجب</h2><div class="form-grid"><label>التكليف<select id="hAssignment">${opts}</select></label><label>عنوان الواجب<input id="hTitle"></label><label class="full">الوصف<textarea id="hDesc" rows="4"></textarea></label><label>تاريخ التسليم<input id="hDue" type="date"></label><button class="primary" id="saveHomework">حفظ الواجب</button></div>`);$("#saveHomework").onclick=async()=>{const a=state.assignments.find(x=>x.id===$("#hAssignment").value);await addDoc(collection(db,"assignments"),{teacherId:state.user.uid,teacherUid:state.user.uid,title:$("#hTitle").value.trim(),description:$("#hDesc").value.trim(),subject:a?.subject||"",classId:a?.classId||"",className:a?.className||"",sectionId:a?.sectionId||"",sectionName:a?.sectionName||a?.classSection||"",dueDate:$("#hDue").value,createdAt:serverTimestamp()});closeModal();toast("تم إنشاء الواجب");await load()}};

async function boot(user){
  state.user=user;

  // أولاً نبحث عن وثيقة users/{uid}. إذا لم تكن موجودة، نستخدم وثيقة المدرس
  // المرتبطة بالبريد الإلكتروني حتى لا تتوقف الصفحة برسالة "لا توجد وثيقة users".
  let p=null;
  try{
    const u=await getDoc(doc(db,"users",user.uid));
    if(u.exists()) p=u.data();
  }catch(err){
    console.warn("تعذر قراءة users/{uid}:",err);
  }

  const tSnap=await getDocs(query(collection(db,"teachers"),where("email","==",user.email||"")));
  state.teacher=tSnap.empty?null:{id:tSnap.docs[0].id,...tSnap.docs[0].data()};

  if(!p && state.teacher){
    p={
      ...state.teacher,
      role:"teacher",
      name:state.teacher.name||state.teacher.fullName||user.displayName||"المدرس",
      email:user.email||state.teacher.email||""
    };
  }

  if(!p) throw Error("لم يتم العثور على بيانات المدرس. أنشئ حساب المدرس في Firebase Authentication ثم أضف مدرساً في مجموعة teachers بنفس البريد الإلكتروني.");
  if(!["teacher","admin"].includes(p.role)) throw Error("هذا الحساب ليس حساب مدرس.");

  state.profile=p;
  const displayName=p.name||p.fullName||state.teacher?.name||user.displayName||"المدرس";
  $("#teacherName").textContent=displayName;
  $("#welcomeName").textContent=displayName;
  $("#teacherEmail").textContent=user.email||p.email||"";
  $("#authOverlay").classList.add("hide");
  $("#connectionStatus").textContent="متصل";
  setupFilters();
  await load();
}
$("#todayDate").textContent=new Date().toLocaleDateString("ar-IQ",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
$("#loginForm").onsubmit=async e=>{e.preventDefault();$("#loginError").textContent="";try{await signInWithEmailAndPassword(auth,$("#loginEmail").value,$("#loginPassword").value)}catch(err){$("#loginError").textContent="بيانات الدخول غير صحيحة أو الحساب غير مفعل."}}
onAuthStateChanged(auth,async user=>{try{if(!user){$("#authMessage").textContent="سجّل الدخول بحساب المدرس.";$("#loginForm").classList.remove("hidden");return}await boot(user)}catch(e){console.error(e);$("#authMessage").textContent=e.message;$("#loginForm").classList.add("hidden")}})
