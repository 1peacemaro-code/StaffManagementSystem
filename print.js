const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwD0Wmgte1oiTCl0UvgzC_-618qD72JPyKOB7PPyw7SFO6MAMR5YnHGRAxmOz6MVB11/exec";
const START_TIME = "16:00";
const END_TIME = "22:00";

const monthSelect = document.getElementById("targetMonth");
const dateSelect = document.getElementById("targetDate");
const loadBtn = document.getElementById("loadBtn");
const printBtn = document.getElementById("printBtn");
const statusBox = document.getElementById("statusBox");
const printArea = document.getElementById("printArea");
const printDate = document.getElementById("printDate");

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = "smsPrintCallback_" + Date.now() + "_" + Math.floor(Math.random()*10000);
    window[cb] = data => { resolve(data); delete window[cb]; script.remove(); };
    const q = new URLSearchParams({action, callback:cb, ...params});
    const script = document.createElement("script");
    script.src = GAS_WEB_APP_URL + "?" + q.toString();
    script.onerror = () => reject(new Error("読み込み失敗"));
    document.body.appendChild(script);
  });
}

function setupMonths() {
  monthSelect.innerHTML = "";
  const now = new Date();
  for(let i=-1;i<=10;i++) {
    const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    const text = `${d.getFullYear()}年${d.getMonth()+1}月`;
    const opt = document.createElement("option");
    opt.value = text;
    opt.textContent = text;
    if(i === 1) opt.selected = true;
    monthSelect.appendChild(opt);
  }
  setupDates();
}

function parseMonthText(text) {
  const m = text.match(/(\d{4})年(\d{1,2})月/);
  if(!m) return null;
  return {year:Number(m[1]), month:Number(m[2])};
}

function setupDates() {
  dateSelect.innerHTML = "";
  const p = parseMonthText(monthSelect.value);
  if(!p) return;
  const last = new Date(p.year, p.month, 0).getDate();
  for(let d=1; d<=last; d++) {
    const value = `${p.year}-${String(p.month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = `${d}日`;
    dateSelect.appendChild(opt);
  }
}

function timeToMinutes(t) {
  const [h,m] = String(t).split(":").map(Number);
  return h*60+m;
}

function minutesToTime(min) {
  return `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
}

function makeSlots() {
  const out = [];
  for(let t=timeToMinutes(START_TIME); t<timeToMinutes(END_TIME); t+=30) {
    out.push(`${minutesToTime(t)}～${minutesToTime(t+30)}`);
  }
  return out;
}

function formatDateLabel(dateValue) {
  const d = new Date(dateValue + "T00:00:00");
  const week = ["日","月","火","水","木","金","土"][d.getDay()];
  return `${monthSelect.value}　${d.getMonth()+1}月${d.getDate()}日（${week}）`;
}

function render(rows) {
  printDate.textContent = formatDateLabel(dateSelect.value);

  if(!rows.length) {
    printArea.className = "print-area empty";
    printArea.textContent = "この日の完成シフトはありません。";
    return;
  }

  const slots = makeSlots();
  const teachers = [...new Set(rows.map(r => r.teacher))].sort();

  const table = document.createElement("table");
  table.className = "shift-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th class='time-col'>時間</th>" + teachers.map(t => `<th>${t}</th>`).join("") + "</tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  slots.forEach(slot => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="time-col">${slot}</td>` + teachers.map(t => {
      const assigned = rows.some(r => r.time === slot && r.teacher === t);
      return `<td class="${assigned ? "assigned" : ""}">${assigned ? "○" : ""}</td>`;
    }).join("");
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  printArea.className = "print-area";
  printArea.innerHTML = "";
  printArea.appendChild(table);
}

async function loadData() {
  statusBox.className = "status neutral";
  statusBox.textContent = "読み込み中です…";
  printArea.className = "print-area empty";
  printArea.textContent = "読み込み中です…";

  try {
    const data = await jsonp("getFinalShift", {month:monthSelect.value, date:dateSelect.value});
    render(data.rows || []);
    statusBox.className = "status success";
    statusBox.textContent = `${monthSelect.value} / ${dateSelect.value} の完成シフトを読み込みました。`;
  } catch(e) {
    console.error(e);
    statusBox.className = "status error";
    statusBox.textContent = "読み込みに失敗しました。";
  }
}

loadBtn.addEventListener("click", loadData);
printBtn.addEventListener("click", () => window.print());
monthSelect.addEventListener("change", setupDates);

setupMonths();
