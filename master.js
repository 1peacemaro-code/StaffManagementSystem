const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwD0Wmgte1oiTCl0UvgzC_-618qD72JPyKOB7PPyw7SFO6MAMR5YnHGRAxmOz6MVB11/exec";
const teacherList = document.getElementById("teacherList");
const statusBox = document.getElementById("statusBox");
const loadBtn = document.getElementById("loadBtn");
const saveBtn = document.getElementById("saveBtn");
const addBtn = document.getElementById("addBtn");
const newTeacherName = document.getElementById("newTeacherName");

let teachers = [];

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = "smsMasterCallback_" + Date.now() + "_" + Math.floor(Math.random()*10000);
    window[cb] = data => { resolve(data); delete window[cb]; script.remove(); };
    const q = new URLSearchParams({action, callback:cb, ...params});
    const script = document.createElement("script");
    script.src = GAS_WEB_APP_URL + "?" + q.toString();
    script.onerror = () => reject(new Error("読み込み失敗"));
    document.body.appendChild(script);
  });
}

function setStatus(type, msg) {
  statusBox.className = "status " + type;
  statusBox.textContent = msg;
}

function render() {
  teacherList.innerHTML = "";
  teachers.sort((a,b)=>Number(a.order)-Number(b.order)).forEach((t, index) => {
    const row = document.createElement("div");
    row.className = "teacher-row";
    row.innerHTML = `
      <input type="number" value="${t.order}" min="1" class="order">
      <input type="text" value="${t.name}" class="name">
      <select class="status-select">
        <option value="表示" ${t.status === "表示" ? "selected" : ""}>表示</option>
        <option value="非表示" ${t.status === "非表示" ? "selected" : ""}>非表示</option>
      </select>
      <button class="delete-btn" type="button">削除</button>
    `;
    row.querySelector(".order").addEventListener("input", e => teachers[index].order = e.target.value);
    row.querySelector(".name").addEventListener("input", e => teachers[index].name = e.target.value);
    row.querySelector(".status-select").addEventListener("change", e => teachers[index].status = e.target.value);
    row.querySelector(".delete-btn").addEventListener("click", () => {
      if(confirm("この先生を一覧から削除しますか？")) {
        teachers.splice(index, 1);
        render();
      }
    });
    teacherList.appendChild(row);
  });
}

async function loadTeachers() {
  setStatus("neutral", "読み込み中です…");
  try {
    const data = await jsonp("getTeacherMaster");
    teachers = data.teachers || [];
    render();
    setStatus("success", "先生マスタを読み込みました。");
  } catch(e) {
    console.error(e);
    setStatus("error", "読み込みに失敗しました。");
  }
}

function addTeacher() {
  const name = newTeacherName.value.trim();
  if(!name) return alert("先生名を入力してください。");
  const maxOrder = teachers.reduce((m,t)=>Math.max(m, Number(t.order)||0), 0);
  teachers.push({order:maxOrder+1, name, status:"表示"});
  newTeacherName.value = "";
  render();
}

async function saveTeachers() {
  const clean = teachers
    .filter(t => String(t.name || "").trim())
    .map(t => ({
      order: Number(t.order) || 999,
      name: String(t.name).trim(),
      status: t.status === "非表示" ? "非表示" : "表示"
    }));

  if(!confirm("先生マスタを保存しますか？")) return;

  try {
    saveBtn.disabled = true;
    setStatus("neutral", "保存中です…");

    await fetch(GAS_WEB_APP_URL, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"saveTeacherMaster", teachers:clean})
    });

    teachers = clean;
    setStatus("success", "保存しました。提出画面の先生プルダウンにも反映されます。");
    alert("保存しました。");
  } catch(e) {
    console.error(e);
    setStatus("error", "保存に失敗しました。");
  } finally {
    saveBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadTeachers);
addBtn.addEventListener("click", addTeacher);
saveBtn.addEventListener("click", saveTeachers);
loadTeachers();
