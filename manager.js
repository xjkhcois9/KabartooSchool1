import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/*
  إعدادات مشروع Firebase.
  هذه القيم هي إعدادات Web App وليست مفاتيح Service Account.
*/
const firebaseConfig = {
  apiKey: "AIzaSyDFzr3gxolAs5ydYfkb-Ui7H4xwDAHXFVU",
  authDomain: "kabartoo-school-system.firebaseapp.com",
  projectId: "kabartoo-school-system",
  storageBucket: "kabartoo-school-system.firebasestorage.app",
  messagingSenderId: "113746991114",
  appId: "1:113746991114:web:93a53ed0d68ac4eb1627f3",
  measurementId: "G-C2WJPCBHKW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { user:null, profile:null, teachers:[], students:[], classes:[], grades:[], attendance:[], exams:[], schedules:[], announcements:[] };

function toast(message){
  const el=$("#toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove("show"),2600);
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function escapeHTML(v=""){ return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function fmtDate(v){ if(!v)return "-"; if(v?.toDate) v=v.toDate(); const d=new Date(v); return isNaN(d)?String(v):d.toLocaleDateString("ar-IQ"); }
function showModal(html){ $("#modalContent").innerHTML=html; $("#modal").classList.add("open"); }
function closeModal(){ $("#modal").classList.remove("open"); $("#modalContent").innerHTML=""; }
$("#modalClose").onclick=closeModal; $("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});

function nav(section){
  $$(".page-section").forEach(x=>x.classList.toggle("active",x.id===section));
  $$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.section===section));
  const titles={dashboard:"لوحة المدير",teachers:"الكادر التدريسي والتكليفات",students:"بيانات الطلاب",expelled:"الطلاب المفصولون",classes:"الصفوف والشعب","grades-entry":"إدخال الدرجات",grades:"سجل الدرجات",attendance:"سجل الحضور",exams:"جدول الامتحانات",schedule:"الجدول الأسبوعي",notifications:"إرسال تنبيه",settings:"إعدادات الموقع"};
  $("#pageTitle").textContent=titles[section]||"لوحة المدير";
  $("#sidebar").classList.remove("open");
  if(section==="dashboard") refreshDashboard();
}
$$("[data-section]").forEach(btn=>btn.addEventListener("click",()=>nav(btn.dataset.section)));
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#logoutBtn").onclick=()=>signOut(auth);

async function loadCollection(name){
  try{
    const snap=await getDocs(collection(db,name));
    return snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(item=>item.deleted!==true);
  }catch(e){
    console.error("Firestore:", name, e);
    throw new Error(`تعذر قراءة بيانات ${name}. تحقق من Cloud Firestore وSecurity Rules.`);
  }
}

async function loadData(){
  [state.teachers,state.students,state.classes,state.grades,state.attendance,state.exams,state.schedules,state.announcements] =
    await Promise.all(["teachers","students","classes","grades","attendance","exams","schedules","announcements"].map(loadCollection));
  renderAll();
}

async function loadProfile(user){
  const ref=doc(db,"users",user.uid); const snap=await getDoc(ref);
  if(!snap.exists()) throw new Error("حساب المدير لا يحتوي على وثيقة users.");
  const p=snap.data();
  if(p.role!=="admin") throw new Error("هذا الحساب ليس مديراً.");
  state.profile={id:snap.id,...p};
  $("#adminName").textContent=p.name||"المدير"; $("#welcomeName").textContent=p.name||"المدير"; $("#adminEmail").textContent=user.email||"";
}

function renderAll(){
  renderStats(); renderTeachers(); renderStudents(); renderExpelled(); renderClasses(); renderGrades(); renderExams(); renderSchedules(); renderNotifications(); populateSelects(); refreshAttendanceSummary();
}
function renderStats(){
  $("#statClasses").textContent=state.classes.length;
  $("#statTeachers").textContent=state.teachers.length;
  $("#statStudents").textContent=state.students.filter(s=>s.status!=="expelled").length;
  const a=state.attendance.filter(x=>x.date===todayISO());
  $("#statPresent").textContent=a.filter(x=>x.status==="present").length;
  $("#statAbsent").textContent=a.filter(x=>x.status==="absent").length;
}
function renderTeachers(){
  const q=$("#teacherSearch").value.toLowerCase();
  const f=$("#teacherFilter").value;
  const rows=state.teachers
    .filter(t=>f==="all"||t.status===f||(!t.status&&f==="active"))
    .filter(t=>(`${t.name||""} ${t.specialization||""} ${t.email||""}`).toLowerCase().includes(q));
  $("#teachersTable").innerHTML=rows.length?rows.map(t=>{
    const count=(t.teachingAssignments||[]).filter(a=>a && a.subject).length;
    return `<tr>
      <td><strong>${escapeHTML(t.name)}</strong><small class="muted-line">${escapeHTML(t.email||"")}</small></td>
      <td>${escapeHTML(t.specialization||"-")}</td>
      <td>${escapeHTML(t.phone||"-")}</td>
      <td><span class="count-badge">${count}</span></td>
      <td><span class="badge ${t.status==="inactive"?"inactive":"active"}">${t.status==="inactive"?"غير نشط":"نشط"}</span></td>
      <td><div class="actions">
        <button class="small-btn" onclick="editTeacher('${t.id}')">تعديل</button>
        <button class="small-btn" onclick="assignTeacher('${t.id}')">تكليف</button>
        <button class="small-btn danger-btn" onclick="deleteTeacher('${t.id}')">حذف المدرس</button>
      </div></td>
    </tr>`
  }).join(""):`<tr><td colspan="6"><div class="empty">لا توجد نتائج.</div></td></tr>`;
}
function renderStudents(){
  const q=($("#studentSearch").value||"").toLowerCase(), f=$("#studentClassFilter").value;
  const rows=state.students.filter(s=>s.status!=="expelled").filter(s=>(f==="all"||`${s.classId}_${s.sectionId}`===f)).filter(s=>(`${s.name||""} ${s.studentId||""}`).toLowerCase().includes(q));
  $("#studentsTable").innerHTML=rows.length?rows.map(s=>`<tr><td>${escapeHTML(s.studentId||s.id)}</td><td><strong>${escapeHTML(s.name)}</strong></td><td>${escapeHTML(s.className||s.classId||"-")}</td><td>${escapeHTML(s.sectionName||s.sectionId||"-")}</td><td>${escapeHTML(s.phone||"-")}</td><td><span class="badge active">نشط</span></td><td><div class="actions"><button class="small-btn" onclick="editStudent('${s.id}')">تعديل</button><button class="small-btn" onclick="expelStudent('${s.id}')">فصل</button></div></td></tr>`).join(""):`<tr><td colspan="7"><div class="empty">لا توجد نتائج.</div></td></tr>`;
}
function renderExpelled(){
 const rows=state.students.filter(s=>s.status==="expelled");
 $("#expelledTable").innerHTML=rows.length?rows.map(s=>`<tr><td>${escapeHTML(s.studentId||s.id)}</td><td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.className||s.classId||"-")}</td><td>${fmtDate(s.expelledAt)}</td><td>${escapeHTML(s.expelReason||"-")}</td><td><button class="small-btn" onclick="restoreStudent('${s.id}')">إعادة تفعيل</button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty">لا يوجد طلاب مفصولون.</div></td></tr>`;
}
function renderClasses(){
 $("#classesList").innerHTML=state.classes.length?state.classes.map(c=>`<div class="class-card"><h3>${escapeHTML(c.name||c.className||"صف")}</h3><p>الشعبة: ${escapeHTML(c.sectionName||c.section||"-")}</p><p>السنة الدراسية: ${escapeHTML(c.academicYear||"-")}</p><button class="small-btn" onclick="editClass('${c.id}')">تعديل</button></div>`).join(""):`<div class="panel empty">لا توجد صفوف وشعب بعد.</div>`;
}
function renderGrades(){
 const q=($("#gradeSearch").value||"").toLowerCase();
 const rows=state.grades.filter(g=>(`${g.studentName||""} ${g.subject||""}`).toLowerCase().includes(q));
 $("#gradesTable").innerHTML=rows.length?rows.map(g=>`<tr><td>${escapeHTML(g.studentName||g.studentId)}</td><td>${escapeHTML(g.subject)}</td><td>${escapeHTML(g.exam||"-")}</td><td><strong>${escapeHTML(g.value)}</strong></td><td>${fmtDate(g.createdAt)}</td></tr>`).join(""):`<tr><td colspan="5"><div class="empty">لا توجد درجات.</div></td></tr>`;
}
function renderExams(){
 $("#examsTable").innerHTML=state.exams.length?state.exams.map(e=>`<tr><td>${escapeHTML(e.subject)}</td><td>${escapeHTML(e.className||e.classId||"-")} / ${escapeHTML(e.sectionName||e.sectionId||"-")}</td><td>${escapeHTML(e.date||"-")}</td><td>${escapeHTML(e.time||"-")}</td><td>${escapeHTML(e.room||"-")}</td><td><button class="small-btn" onclick="deleteDocItem('exams','${e.id}')">حذف</button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty">لا يوجد جدول امتحانات.</div></td></tr>`;
}
function renderSchedules(){
 $("#scheduleTable").innerHTML=state.schedules.length?state.schedules.map(s=>`<tr><td>${escapeHTML(s.day)}</td><td>${escapeHTML(s.period)}</td><td>${escapeHTML(s.className||s.classId||"-")} / ${escapeHTML(s.sectionName||s.sectionId||"-")}</td><td>${escapeHTML(s.subject)}</td><td>${escapeHTML(s.teacherName||s.teacherId||"-")}</td><td><button class="small-btn" onclick="deleteDocItem('schedules','${s.id}')">حذف</button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty">لا يوجد جدول أسبوعي.</div></td></tr>`;
}
function renderNotifications(){
 $("#notificationsList").innerHTML=state.announcements.length?state.announcements.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,20).map(a=>`<div class="activity-item"><strong>${escapeHTML(a.title)}</strong><small>${escapeHTML(a.body)} — الجهة: ${escapeHTML(a.targetLabel||a.target||"الجميع")}</small></div>`).join(""):`<div class="empty">لا توجد تنبيهات.</div>`;
 const latest=state.announcements.slice(0,4);
 $("#latestAnnouncements").innerHTML=latest.length?latest.map(a=>`<div class="activity-item"><strong>${escapeHTML(a.title)}</strong><small>${escapeHTML(a.targetLabel||a.target||"الجميع")}</small></div>`).join(""):`<div class="empty">لا توجد إعلانات بعد.</div>`;
}
function populateSelects(){
  const classOptions=state.classes.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(c.name||c.className)} / ${escapeHTML(c.sectionName||c.section||"")}</option>`).join("");
  $("#studentClassFilter").innerHTML=`<option value="all">كل الصفوف والشعب</option>${classOptions}`;
  $("#attendanceClassFilter").innerHTML=`<option value="all">كل الصفوف والشعب</option>${classOptions}`;
  const oldSchedule=$("#scheduleClassFilter")?.value||"";
  $("#scheduleClassFilter").innerHTML=`<option value="">اختر الصف والشعبة</option>${classOptions}`;
  if(oldSchedule && state.classes.some(c=>c.id===oldSchedule)) $("#scheduleClassFilter").value=oldSchedule;
  $("#gradeStudent").innerHTML=state.students.filter(s=>s.status!=="expelled").map(s=>`<option value="${s.id}">${escapeHTML(s.name)} — ${escapeHTML(s.studentId||s.id)}</option>`).join("");
}
function refreshAttendanceSummary(){
 const a=state.attendance.filter(x=>x.date===todayISO());
 $("#sumPresent").textContent=a.filter(x=>x.status==="present").length;
 $("#sumAbsent").textContent=a.filter(x=>x.status==="absent").length;
 $("#sumLate").textContent=a.filter(x=>x.status==="late").length;
 $("#sumLeave").textContent=a.filter(x=>x.status==="leave").length;
}
function refreshDashboard(){renderStats();refreshAttendanceSummary();renderNotifications()}

function teacherForm(t={}){
 return `<h2>${t.id?"تعديل مدرس":"إضافة مدرس"}</h2><div class="form-grid"><label>الاسم<input id="mName" value="${escapeHTML(t.name||"")}"></label><label>التخصص<input id="mSpec" value="${escapeHTML(t.specialization||"")}"></label><label>الهاتف<input id="mPhone" value="${escapeHTML(t.phone||"")}"></label><label>البريد<input id="mEmail" value="${escapeHTML(t.email||"")}"></label><label>الحالة<select id="mStatus"><option value="active" ${t.status!=="inactive"?"selected":""}>نشط</option><option value="inactive" ${t.status==="inactive"?"selected":""}>غير نشط</option></select></label><button class="primary" id="saveTeacher">حفظ</button></div>`;
}
$("#addTeacherBtn").onclick=()=>{showModal(teacherForm());$("#saveTeacher").onclick=async()=>{await addDoc(collection(db,"teachers"),{name:$("#mName").value.trim(),specialization:$("#mSpec").value.trim(),phone:$("#mPhone").value.trim(),email:$("#mEmail").value.trim(),status:$("#mStatus").value,createdAt:serverTimestamp()});closeModal();toast("تمت إضافة المدرس");await loadData()}};
window.editTeacher=async(id)=>{const t=state.teachers.find(x=>x.id===id);showModal(teacherForm(t));$("#saveTeacher").onclick=async()=>{await updateDoc(doc(db,"teachers",id),{name:$("#mName").value.trim(),specialization:$("#mSpec").value.trim(),phone:$("#mPhone").value.trim(),email:$("#mEmail").value.trim(),status:$("#mStatus").value,updatedAt:serverTimestamp()});closeModal();toast("تم تحديث بيانات المدرس");await loadData()}};
window.assignTeacher=(id)=>{
  const t=state.teachers.find(x=>x.id===id);
  if(!t)return;
  const opts=state.classes.map(c=>`<option value="${c.id}">${escapeHTML(c.name||c.className)} / ${escapeHTML(c.sectionName||c.section||"")}</option>`).join("");
  const current=(t.teachingAssignments||[]).map((a,i)=>`<div class="assignment-row"><span><strong>${escapeHTML(a.subject||"-")}</strong> — ${escapeHTML(a.className||"")} / ${escapeHTML(a.classSection||a.sectionName||"")}</span><button type="button" class="small-btn danger-btn" onclick="removeTeacherAssignment('${id}',${i})">حذف</button></div>`).join("");
  showModal(`<h2>تكليف ${escapeHTML(t.name)}</h2>
    <p>أضف المادة والصف والشعبة. سيظهر التكليف في حساب المدرس أيضًا.</p>
    <div class="form-grid">
      <label>المادة<input id="aSubject" placeholder="مثال: الرياضيات"></label>
      <label>الصف/الشعبة<select id="aClass">${opts}</select></label>
      <button class="primary" id="saveAssign">إضافة التكليف</button>
    </div>
    <div class="assignment-list"><h3>التكليفات الحالية</h3>${current||'<div class="empty">لا توجد تكليفات بعد.</div>'}</div>`);
  $("#saveAssign").onclick=async()=>{
    const subject=$("#aSubject").value.trim();
    const c=state.classes.find(x=>x.id===$("#aClass").value);
    if(!subject||!c)return toast("أدخل المادة واختر الصف والشعبة");
    const assignment={
      teacherId:t.id,
      teacherUid:t.authUid||"",
      teacherName:t.name||"",
      teacherEmail:t.email||"",
      subject,
      classId:c.id,
      className:c.name||c.className||"",
      sectionId:c.sectionId||c.id,
      sectionName:c.sectionName||c.section||"",
      active:true,
      createdAt:serverTimestamp()
    };
    const arr=[...(t.teachingAssignments||[])];
    arr.push({subject,classId:c.id,className:assignment.className,sectionId:assignment.sectionId,classSection:assignment.sectionName});
    await updateDoc(doc(db,"teachers",id),{teachingAssignments:arr,updatedAt:serverTimestamp()});
    await addDoc(collection(db,"teachingAssignments"),assignment);
    closeModal(); toast("تمت إضافة التكليف وربطه بحساب المدرس"); await loadData();
  };
};

window.removeTeacherAssignment=async(id,index)=>{
  const t=state.teachers.find(x=>x.id===id); if(!t)return;
  const arr=[...(t.teachingAssignments||[])];
  if(index<0||index>=arr.length)return;
  const a=arr[index];
  if(!confirm(`حذف تكليف ${a.subject||""}؟`))return;
  arr.splice(index,1);
  await updateDoc(doc(db,"teachers",id),{teachingAssignments:arr,updatedAt:serverTimestamp()});
  try{
    const snap=await getDocs(query(collection(db,"teachingAssignments"),where("teacherId","==",id)));
    const matches=snap.docs.filter(d=>d.data().subject===a.subject && d.data().classId===a.classId);
    await Promise.all(matches.map(d=>deleteDoc(d.ref)));
  }catch(e){console.warn("تعذر حذف سجل التكليف المنفصل",e)}
  toast("تم حذف التكليف"); await loadData();
};

window.deleteTeacher=async(id)=>{
  const t=state.teachers.find(x=>x.id===id); if(!t)return;
  if(!confirm(`هل تريد حذف المدرس «${t.name||""}» من النظام؟
سيتم حذف ملفه والتكليفات، مع إبقاء السجلات التاريخية مثل الدرجات والحضور.`))return;
  try{
    const snap=await getDocs(query(collection(db,"teachingAssignments"),where("teacherId","==",id)));
    await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
    // If an Auth-linked UID exists, disable the application profile. The Auth account itself
    // cannot be deleted safely from a browser by an administrator; that requires Admin SDK/Console.
    const authUid=t.authUid||"";
    if(authUid){
      await setDoc(doc(db,"users",authUid),{active:false,role:"teacher_disabled",disabledAt:serverTimestamp()},{merge:true});
    }else if(t.email){
      const us=await getDocs(query(collection(db,"users"),where("email","==",t.email)));
      await Promise.all(us.docs.map(d=>updateDoc(d.ref,{active:false,role:"teacher_disabled",disabledAt:serverTimestamp()})));
    }
    await deleteDoc(doc(db,"teachers",id));
    toast("تم حذف المدرس من النظام");
    await loadData();
  }catch(e){
    console.error(e);
    toast("تعذر حذف المدرس. تحقق من صلاحيات Firestore.");
  }
};

function studentForm(s={}){
 const opts=state.classes.map(c=>`<option value="${c.id}" ${s.classId===c.id?"selected":""}>${escapeHTML(c.name||c.className)} / ${escapeHTML(c.sectionName||c.section||"")}</option>`).join("");
 return `<h2>${s.id?"تعديل طالب":"إضافة طالب"}</h2><div class="form-grid"><label>رقم الطالب<input id="sId" value="${escapeHTML(s.studentId||"")}"></label><label>الاسم الكامل<input id="sName" value="${escapeHTML(s.name||"")}"></label><label>الصف والشعبة<select id="sClass">${opts}</select></label><label>الهاتف<input id="sPhone" value="${escapeHTML(s.phone||"")}"></label><label>البريد<input id="sEmail" value="${escapeHTML(s.email||"")}"></label><button class="primary" id="saveStudent">حفظ</button></div>`;
}
$("#addStudentBtn").onclick=()=>{showModal(studentForm());$("#saveStudent").onclick=async()=>{const c=state.classes.find(x=>x.id===$("#sClass").value);await addDoc(collection(db,"students"),{studentId:$("#sId").value.trim(),name:$("#sName").value.trim(),classId:c?.id||"",className:c?.name||c?.className||"",sectionId:c?.sectionId||c?.section||"",sectionName:c?.sectionName||c?.section||"",phone:$("#sPhone").value.trim(),email:$("#sEmail").value.trim(),status:"active",createdAt:serverTimestamp()});closeModal();toast("تمت إضافة الطالب");await loadData()}};
window.editStudent=async(id)=>{const s=state.students.find(x=>x.id===id);showModal(studentForm(s));$("#saveStudent").onclick=async()=>{const c=state.classes.find(x=>x.id===$("#sClass").value);await updateDoc(doc(db,"students",id),{studentId:$("#sId").value.trim(),name:$("#sName").value.trim(),classId:c?.id||"",className:c?.name||c?.className||"",sectionId:c?.sectionId||c?.section||"",sectionName:c?.sectionName||c?.section||"",phone:$("#sPhone").value.trim(),email:$("#sEmail").value.trim(),updatedAt:serverTimestamp()});closeModal();toast("تم تحديث الطالب");await loadData()}};
window.expelStudent=async(id)=>{const reason=prompt("سبب الفصل:");if(reason===null)return;await updateDoc(doc(db,"students",id),{status:"expelled",expelReason:reason,expelledAt:serverTimestamp(),updatedAt:serverTimestamp()});toast("تم نقل الطالب إلى قائمة المفصولين");await loadData()};
window.restoreStudent=async(id)=>{await updateDoc(doc(db,"students",id),{status:"active",updatedAt:serverTimestamp()});toast("تمت إعادة تفعيل الطالب");await loadData()};

$("#addClassBtn").onclick=()=>{showModal(`<h2>إضافة صف وشعبة</h2><div class="form-grid"><label>اسم الصف<input id="cName" placeholder="الرابع الإعدادي"></label><label>اسم الشعبة<input id="cSection" placeholder="A"></label><label>العام الدراسي<input id="cYear" value="2026-2027"></label><button class="primary" id="saveClass">حفظ</button></div>`);$("#saveClass").onclick=async()=>{await addDoc(collection(db,"classes"),{name:$("#cName").value.trim(),sectionName:$("#cSection").value.trim(),academicYear:$("#cYear").value.trim(),createdAt:serverTimestamp()});closeModal();toast("تمت إضافة الصف والشعبة");await loadData()}};
window.editClass=(id)=>{const c=state.classes.find(x=>x.id===id);showModal(`<h2>تعديل الصف والشعبة</h2><div class="form-grid"><label>اسم الصف<input id="ecName" value="${escapeHTML(c.name||c.className||"")}"></label><label>الشعبة<input id="ecSection" value="${escapeHTML(c.sectionName||c.section||"")}"></label><label>العام الدراسي<input id="ecYear" value="${escapeHTML(c.academicYear||"")}"></label><button class="primary" id="ecSave">حفظ</button></div>`);$("#ecSave").onclick=async()=>{await updateDoc(doc(db,"classes",id),{name:$("#ecName").value.trim(),sectionName:$("#ecSection").value.trim(),academicYear:$("#ecYear").value.trim(),updatedAt:serverTimestamp()});closeModal();toast("تم التحديث");await loadData()}};

$("#saveGradeBtn").onclick=async()=>{const s=state.students.find(x=>x.id===$("#gradeStudent").value);const value=Number($("#gradeValue").value);if(!s||!$("#gradeSubject").value.trim()||!$("#gradeExam").value.trim()||Number.isNaN(value))return toast("أكمل بيانات الدرجة");await addDoc(collection(db,"grades"),{studentId:s.id,studentName:s.name,subject:$("#gradeSubject").value.trim(),exam:$("#gradeExam").value.trim(),value,createdAt:serverTimestamp()});toast("تم حفظ الدرجة");$("#gradeValue").value="";await loadData()};
$("#gradeSearch").oninput=renderGrades;$("#teacherSearch").oninput=renderTeachers;$("#teacherFilter").onchange=renderTeachers;$("#studentSearch").oninput=renderStudents;$("#studentClassFilter").onchange=renderStudents;

$("#attendanceDate").value=todayISO();
$("#loadAttendanceBtn").onclick=renderAttendance;
$("#attendanceClassFilter").onchange=renderAttendance;
$("#saveAttendanceAllBtn").onclick=saveAttendanceAll;

async function renderAttendance(){
  const date=$("#attendanceDate").value||todayISO();
  const cls=$("#attendanceClassFilter").value;
  const students=state.students.filter(s=>s.status!=="expelled").filter(s=>cls==="all"||s.classId===cls);
  const existing=state.attendance.filter(a=>a.date===date);
  $("#attendanceTable").innerHTML=students.length?students.map(s=>{
    const a=existing.find(x=>x.studentId===s.id);
    const status=a?.status||"present";
    return `<tr><td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.className||s.classId||"-")}</td><td>${escapeHTML(s.sectionName||s.sectionId||"-")}</td><td><select id="att-${s.id}"><option value="present" ${status==="present"?"selected":""}>حاضر</option><option value="absent" ${status==="absent"?"selected":""}>غائب</option><option value="late" ${status==="late"?"selected":""}>متأخر</option><option value="leave" ${status==="leave"?"selected":""}>إجازة</option></select></td><td><button class="small-btn" onclick="saveAttendance('${s.id}','${a?.id||""}')">حفظ</button></td></tr>`;
  }).join(""):`<tr><td colspan="5"><div class="empty">لا يوجد طلاب لهذا الصف/الشعبة.</div></td></tr>`;
}

window.saveAttendance=async(studentId,aid)=>{
  const s=state.students.find(x=>x.id===studentId), date=$("#attendanceDate").value, status=$(`#att-${studentId}`).value;
  if(!s)return;
  const data={studentId,studentName:s.name,date,status,classId:s.classId,sectionId:s.sectionId,sectionName:s.sectionName||"",updatedAt:serverTimestamp()};
  if(aid)await updateDoc(doc(db,"attendance",aid),data); else await addDoc(collection(db,"attendance"),{...data,createdAt:serverTimestamp()});
  toast("تم حفظ حضور الطالب"); await loadData(); await renderAttendance();
};

async function saveAttendanceAll(){
  const date=$("#attendanceDate").value||todayISO();
  const cls=$("#attendanceClassFilter").value;
  const students=state.students.filter(s=>s.status!=="expelled").filter(s=>cls==="all"||s.classId===cls);
  if(!students.length)return toast("لا يوجد طلاب للحفظ");
  const existing=state.attendance.filter(a=>a.date===date);
  try{
    await Promise.all(students.map(async s=>{
      const status=$(`#att-${s.id}`)?.value||"present";
      const old=existing.find(a=>a.studentId===s.id);
      const data={studentId:s.id,studentName:s.name,date,status,classId:s.classId,sectionId:s.sectionId,sectionName:s.sectionName||"",updatedAt:serverTimestamp()};
      if(old) await updateDoc(doc(db,"attendance",old.id),data);
      else await addDoc(collection(db,"attendance"),{...data,createdAt:serverTimestamp()});
    }));
    toast("تم حفظ حضور الصف بالكامل");
    await loadData(); await renderAttendance();
  }catch(e){console.error(e);toast("تعذر حفظ سجل الحضور");}
}

$("#addExamBtn").onclick=()=>{const opts=state.classes.map(c=>`<option value="${c.id}">${escapeHTML(c.name||c.className)} / ${escapeHTML(c.sectionName||c.section||"")}</option>`).join("");showModal(`<h2>إضافة امتحان</h2><div class="form-grid"><label>المادة<input id="eSubject"></label><label>الصف/الشعبة<select id="eClass">${opts}</select></label><label>التاريخ<input id="eDate" type="date"></label><label>الوقت<input id="eTime" type="time"></label><label>القاعة<input id="eRoom"></label><button class="primary" id="saveExam">حفظ</button></div>`);$("#saveExam").onclick=async()=>{const c=state.classes.find(x=>x.id===$("#eClass").value);await addDoc(collection(db,"exams"),{subject:$("#eSubject").value.trim(),classId:c?.id,className:c?.name||c?.className||"",sectionId:c?.sectionId||c?.section||"",sectionName:c?.sectionName||c?.section||"",date:$("#eDate").value,time:$("#eTime").value,room:$("#eRoom").value.trim(),createdAt:serverTimestamp()});closeModal();toast("تمت إضافة الامتحان");await loadData()}};

const SCHEDULE_DAYS=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
function scheduleKey(classId,day,period){return `${classId}__${encodeURIComponent(day)}__${period}`;}

function scheduleGridData(classId){
  const map={};
  state.schedules.filter(s=>s.classId===classId && s.deleted!==true).forEach(s=>{map[`${s.day}__${String(s.period)}`]=s;});
  return map;
}

function renderSchedules(){
  const selected=$("#scheduleClassFilter")?.value||"";
  if(selected) renderScheduleGrid();
  else $("#scheduleGridWrap").innerHTML='<div class="empty">اختر الصف والشعبة ثم اضغط «عرض الجدول».</div>';
}

function renderScheduleGrid(){
  const classId=$("#scheduleClassFilter").value;
  if(!classId)return toast("اختر الصف والشعبة أولاً");
  const count=Number($("#schedulePeriodCount").value||8);
  const map=scheduleGridData(classId);
  const teacherOptions=state.teachers.filter(t=>t.status!=="inactive").map(t=>`<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`).join("");
  let html='<table class="weekly-schedule"><thead><tr><th class="period-head">الحصة</th>';
  html+=SCHEDULE_DAYS.map(d=>`<th>${d}</th>`).join('');
  html+='</tr></thead><tbody>';
  for(let p=1;p<=count;p++){
    html+=`<tr><th class="period-head">${p}</th>`;
    for(const day of SCHEDULE_DAYS){
      const s=map[`${day}__${p}`]||{};
      const teacherId=s.teacherId||"";
      html+=`<td class="schedule-cell">
        <input class="schedule-subject" data-day="${escapeHTML(day)}" data-period="${p}" value="${escapeHTML(s.subject||"")}" placeholder="المادة">
        <select class="schedule-teacher" data-day="${escapeHTML(day)}" data-period="${p}"><option value="">المدرس</option>${teacherOptions}</select>
      </td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  $("#scheduleGridWrap").innerHTML=html;
  $("#scheduleGridWrap").querySelectorAll('.schedule-teacher').forEach(el=>{el.value=map[`${el.dataset.day}__${el.dataset.period}`]?.teacherId||"";});
}

$("#loadScheduleGridBtn").onclick=renderScheduleGrid;
$("#schedulePeriodCount").onchange=()=>{if($("#scheduleClassFilter").value)renderScheduleGrid();};
$("#saveScheduleGridBtn").onclick=async()=>{
  const classId=$("#scheduleClassFilter").value;
  if(!classId)return toast("اختر الصف والشعبة أولاً");
  const c=state.classes.find(x=>x.id===classId); if(!c)return;
  const count=Number($("#schedulePeriodCount").value||8);
  const old=state.schedules.filter(s=>s.classId===classId && s.deleted!==true);
  const oldMap={}; old.forEach(s=>oldMap[`${s.day}__${String(s.period)}`]=s);
  try{
    const ops=[];
    for(let p=1;p<=count;p++) for(const day of SCHEDULE_DAYS){
      const subject=$(`.schedule-subject[data-day="${CSS.escape(day)}"][data-period="${p}"]`)?.value.trim()||"";
      const teacherId=$( `.schedule-teacher[data-day="${CSS.escape(day)}"][data-period="${p}"]` )?.value||"";
      const teacher=state.teachers.find(t=>t.id===teacherId);
      const oldDoc=oldMap[`${day}__${p}`];
      if(!subject && !teacherId){
        if(oldDoc) ops.push(updateDoc(doc(db,"schedules",oldDoc.id),{deleted:true,deletedAt:serverTimestamp()}));
      }else{
        const data={day,period:String(p),classId,className:c.name||c.className||"",sectionId:c.sectionId||c.id,sectionName:c.sectionName||c.section||"",subject,teacherId:teacherId||"",teacherName:teacher?.name||"",deleted:false,updatedAt:serverTimestamp()};
        if(oldDoc) ops.push(updateDoc(doc(db,"schedules",oldDoc.id),data));
        else ops.push(setDoc(doc(db,"schedules",scheduleKey(classId,day,p)),{...data,createdAt:serverTimestamp()}));
      }
    }
    await Promise.all(ops);
    toast("تم حفظ الجدول الأسبوعي بالكامل");
    await loadData(); renderScheduleGrid();
  }catch(e){console.error(e);toast("تعذر حفظ الجدول الأسبوعي");}
};

window.deleteDocItem=async(col,id)=>{if(!confirm("هل تريد الحذف؟"))return;await updateDoc(doc(db,col,id),{deleted:true,deletedAt:serverTimestamp()});toast("تم تنفيذ العملية");await loadData()};

$("#notifyTarget").onchange=()=>{const v=$("#notifyTarget").value, wrap=$("#notifyTargetValueWrap");if(["class","section","individual"].includes(v)){wrap.classList.remove("hidden");let opts="";if(v==="individual")opts=state.students.concat(state.teachers).map(x=>`<option value="${x.id}">${escapeHTML(x.name)}</option>`).join("");else opts=state.classes.map(c=>`<option value="${c.id}">${escapeHTML(c.name||c.className)} / ${escapeHTML(c.sectionName||c.section||"")}</option>`).join("");$("#notifyTargetValue").innerHTML=opts}else wrap.classList.add("hidden")};
$("#sendNotificationBtn").onclick=async()=>{const target=$("#notifyTarget").value,title=$("#notifyTitle").value.trim(),body=$("#notifyBody").value.trim();if(!title||!body)return toast("أدخل عنوان ونص التنبيه");const labels={all:"الجميع",students:"جميع الطلاب",teachers:"جميع المدرسين",class:"صف",section:"شعبة",individual:"مستخدم محدد"};await addDoc(collection(db,"announcements"),{title,body,target,targetId:$("#notifyTargetValue").value||"",targetLabel:labels[target],createdBy:state.user.uid,createdAt:serverTimestamp()});toast("تم إرسال التنبيه");$("#notifyTitle").value="";$("#notifyBody").value="";await loadData()};

async function loadSettings(){
 try{const s=await getDoc(doc(db,"settings","school"));if(s.exists()){const d=s.data();$("#setSchoolName").value=d.schoolName||"";$("#setAcademicYear").value=d.academicYear||"";$("#setPhone").value=d.phone||"";$("#setAddress").value=d.address||"";$("#setDescription").value=d.description||"";$("#schoolNameSide").textContent=d.schoolName||"مدرستي"}}catch(e){}
}
$("#saveSettingsBtn").onclick=async()=>{
  try{
    await setDoc(doc(db,"settings","school"),{
      schoolName:$("#setSchoolName").value.trim(),
      academicYear:$("#setAcademicYear").value.trim(),
      phone:$("#setPhone").value.trim(),
      address:$("#setAddress").value.trim(),
      description:$("#setDescription").value.trim(),
      updatedAt:serverTimestamp()
    },{merge:true});
    toast("تم حفظ الإعدادات");
    await loadSettings();
  }catch(e){
    console.error(e);
    toast("تعذر حفظ الإعدادات");
  }
};

$("#todayDate").textContent=new Date().toLocaleDateString("ar-IQ",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

function authMessage(code){
  const messages={
    "auth/invalid-credential":"البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/invalid-email":"صيغة البريد الإلكتروني غير صحيحة.",
    "auth/user-not-found":"لا يوجد حساب بهذا البريد.",
    "auth/wrong-password":"كلمة المرور غير صحيحة.",
    "auth/too-many-requests":"تمت محاولات كثيرة. حاول لاحقاً.",
    "auth/network-request-failed":"تعذر الاتصال بالإنترنت."
  };
  return messages[code] || "تعذر تسجيل الدخول. تحقق من بيانات الحساب وإعدادات Firebase.";
}

function showLogin(message=""){
  $("#authOverlay").classList.remove("hide");
  $("#authOverlay").innerHTML=`
    <div class="auth-card">
      <div class="brand-mark">S</div>
      <h2>تسجيل دخول المدير</h2>
      <p>سجّل الدخول للوصول إلى لوحة إدارة المدرسة.</p>
      ${message?`<p style="color:#b42318">${escapeHTML(message)}</p>`:""}
      <form id="adminLoginForm" class="form-grid">
        <label>البريد الإلكتروني<input id="loginEmail" type="email" autocomplete="username" required></label>
        <label>كلمة المرور<input id="loginPassword" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">دخول إلى لوحة المدير</button>
      </form>
    </div>`;
  $("#adminLoginForm").onsubmit=async(e)=>{
    e.preventDefault();
    const btn=e.currentTarget.querySelector("button");
    btn.disabled=true;
    btn.textContent="جارٍ تسجيل الدخول...";
    try{
      await signInWithEmailAndPassword(
        auth,
        $("#loginEmail").value.trim(),
        $("#loginPassword").value
      );
    }catch(err){
      console.error(err);
      showLogin(authMessage(err.code));
    }
  };
}

onAuthStateChanged(auth,async(user)=>{
  if(!user){
    showLogin();
    return;
  }

  try{
    state.user=user;
    await loadProfile(user);
    await loadSettings();
    await loadData();
    $("#authOverlay").classList.add("hide");
    $("#connectionStatus").textContent="متصل";
  }catch(e){
    console.error(e);
    $("#connectionStatus").textContent="خطأ";
    $("#authOverlay").classList.remove("hide");
    $("#authOverlay").innerHTML=`
      <div class="auth-card">
        <div class="brand-mark">!</div>
        <h2>تعذر فتح لوحة المدير</h2>
        <p>${escapeHTML(e.message)}</p>
        <p>تأكد من وجود users/${escapeHTML(user.uid)} في Cloud Firestore وأن role = admin.</p>
        <button class="primary" id="retryAuth">إعادة المحاولة</button>
        <button class="secondary" id="logoutRetry">تسجيل الخروج</button>
      </div>`;
    $("#retryAuth").onclick=()=>location.reload();
    $("#logoutRetry").onclick=()=>signOut(auth);
  }
});