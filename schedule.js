const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwD0Wmgte1oiTCl0UvgzC_-618qD72JPyKOB7PPyw7SFO6MAMR5YnHGRAxmOz6MVB11/exec";
const START_TIME = "16:00";
const END_TIME = "22:00";

const monthSelect = document.getElementById("targetMonth");
const dateSelect = document.getElementById("targetDate");
const loadBtn = document.getElementById("loadBtn");
const statusBox = document.getElementById("statusBox");
const slotList = document.getElementById("slotList");
const timeline = document.getElementById("timeline");

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = "smsScheduleCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    window[cb] = (data) => { resolve(data); delete window[cb]; script.remove(); };
    const query = new URLSearchParams({ action, callback: cb, ...params });
    const script = document.createElement("script");
    script.src = GAS_WEB_APP_URL + "?" + query.toString();
    script.onerror = () => reject(new Error("読み込み失敗"));
    document.body.appendChild(script);
  });
}

function setupMonths() {
  monthSelect.innerHTML = "";
  const now = new Date();
  for (let i = -1; i <= 10; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const text = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    const opt = document.createElement("option");
    opt.value = text;
    opt.textContent = text;
    if (i === 1) opt.selected = true;
    monthSelect.appendChild(opt);
  }
  setupDates();
}

function parseMonthText(text) {
  const m = text.match(/(\d{4})年(\d{1,2})月/);
  if (!m) return null;
  return { year:Number(m[1]), month:Number(m[2]) };
}

function setupDates() {
  dateSelect.innerHTML = "";
  const parsed = parseMonthText(monthSelect.value);
  if (!parsed) return;
  const last = new Date(parsed.year, parsed.month, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const value = `${parsed.year}-${String(parsed.month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
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
  const h = Math.floor(min/60);
  const m = min%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function makeSlots() {
  const slots = [];
  for (let t=timeToMinutes(START_TIME); t<timeToMinutes(END_TIME); t+=30) {
    slots.push({start:t,end:t+30,label:`${minutesToTime(t)}～${minutesToTime(t+30)}`});
  }
  return slots;
}
function intervalContains(intervals, slot) {
  return intervals.some(i => i.start <= slot.start && i.end >= slot.end);
}
function subtractIntervals(base, blocks) {
  let intervals = [base];
  blocks.forEach(block => {
    const next = [];
    intervals.forEach(intv => {
      if (block.end <= intv.start || block.start >= intv.end) next.push(intv);
      else {
        if (block.start > intv.start) next.push({start:intv.start,end:block.start});
        if (block.end < intv.end) next.push({start:block.end,end:intv.end});
      }
    });
    intervals = next;
  });
  return intervals.filter(i => i.end > i.start);
}
function lessonBlocks(row, lessons) {
  return (row.normalLessons||[]).map(name => {
    const l = lessons.find(x => String(x.name) === String(name));
    if (!l) return null;
    return {start:timeToMinutes(l.start), end:timeToMinutes(l.end)};
  }).filter(Boolean);
}
function standardBlocks(row) {
  return (row.standard||[]).map(s => {
    if (!s.start || !s.end) return null;
    return {start:timeToMinutes(s.start), end:timeToMinutes(s.end)};
  }).filter(Boolean);
}
function freeIntervals(row, lessons) {
  const base = {start:timeToMinutes(row.workStart), end:timeToMinutes(row.workEnd)};
  const blocks = [...lessonBlocks(row, lessons), ...standardBlocks(row)].sort((a,b)=>a.start-b.start);
  return subtractIntervals(base, blocks);
}

function render(rows, lessons) {
  const targetDate = dateSelect.value;
  const dayRows = rows.filter(r => r.date === targetDate);
  const slots = makeSlots();

  slotList.innerHTML = "";
  timeline.innerHTML = "";

  if (!dayRows.length) {
    slotList.innerHTML = '<p class="empty">この日の提出データはありません。</p>';
    timeline.innerHTML = '<p class="empty" style="padding:16px;">この日の提出データはありません。</p>';
    return;
  }

  slots.forEach(slot => {
    const names = dayRows
      .filter(r => intervalContains(freeIntervals(r, lessons), slot))
      .map(r => r.teacher);

    const card = document.createElement("div");
    card.className = "slot-card";
    card.innerHTML = `<div class="slot-time">${slot.label}</div>` + 
      (names.length ? names.map(n => `<span class="teacher-chip">${n}</span>`).join("") : '<span class="empty">該当なし</span>');
    slotList.appendChild(card);
  });

  const head = document.createElement("div");
  head.className = "timeline-row timeline-head";
  head.innerHTML = '<div class="timeline-cell">先生</div>' + slots.map(s => `<div class="timeline-cell">${minutesToTime(s.start)}</div>`).join("");
  timeline.appendChild(head);

  dayRows.forEach(row => {
    const free = freeIntervals(row, lessons);
    const tr = document.createElement("div");
    tr.className = "timeline-row";
    tr.innerHTML = `<div class="timeline-cell teacher-name">${row.teacher}</div>` + slots.map(slot => {
      const ok = intervalContains(free, slot);
      return `<div class="timeline-cell ${ok ? "free-cell" : "busy-cell"}">${ok ? "○" : ""}</div>`;
    }).join("");
    timeline.appendChild(tr);
  });
}

async function loadData() {
  statusBox.className = "status neutral";
  statusBox.textContent = "読み込み中です…";
  slotList.innerHTML = "";
  timeline.innerHTML = "";
  try {
    const data = await jsonp("getLatest", {month: monthSelect.value});
    render(data.rows || [], data.lessons || []);
    statusBox.className = "status success";
    statusBox.textContent = `${monthSelect.value} / ${dateSelect.value} を読み込みました。`;
  } catch(e) {
    console.error(e);
    statusBox.className = "status neutral";
    statusBox.textContent = "読み込みに失敗しました。";
  }
}

monthSelect.addEventListener("change", setupDates);
loadBtn.addEventListener("click", loadData);
setupMonths();
