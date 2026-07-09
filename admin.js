const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwD0Wmgte1oiTCl0UvgzC_-618qD72JPyKOB7PPyw7SFO6MAMR5YnHGRAxmOz6MVB11/exec";

const monthSelect = document.getElementById("targetMonth");
const loadBtn = document.getElementById("loadBtn");
const statusBox = document.getElementById("statusBox");
const resultArea = document.getElementById("resultArea");

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = "smsAdminCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
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
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function subtractIntervals(base, blocks) {
  let intervals = [base];
  blocks.forEach(block => {
    const next = [];
    intervals.forEach(intv => {
      if (block.end <= intv.start || block.start >= intv.end) {
        next.push(intv);
      } else {
        if (block.start > intv.start) next.push({ start: intv.start, end: block.start });
        if (block.end < intv.end) next.push({ start: block.end, end: intv.end });
      }
    });
    intervals = next;
  });
  return intervals.filter(x => x.end > x.start);
}

function formatIntervals(list) {
  if (!list.length) return "なし";
  return list.map(x => `${minutesToTime(x.start)}～${minutesToTime(x.end)}`).join("\n");
}

function getLessonBlocks(normalLessons, lessonsMaster) {
  return (normalLessons || []).map(name => {
    const lesson = lessonsMaster.find(l => String(l.name) === String(name));
    if (!lesson) return null;
    return { start: timeToMinutes(lesson.start), end: timeToMinutes(lesson.end) };
  }).filter(Boolean);
}

function getStandardBlocks(standard) {
  return (standard || []).map(s => {
    if (!s.start || !s.end) return null;
    return { start: timeToMinutes(s.start), end: timeToMinutes(s.end) };
  }).filter(Boolean);
}

function groupByDate(rows) {
  const map = new Map();
  rows.forEach(r => {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date).push(r);
  });
  return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]));
}

function render(data) {
  const rows = data.rows || [];
  const lessons = data.lessons || [];
  resultArea.innerHTML = "";

  if (!rows.length) {
    resultArea.innerHTML = '<p class="empty">この月の提出データはありません。</p>';
    return;
  }

  const grouped = groupByDate(rows);
  grouped.forEach(([date, dayRows]) => {
    const dayBlock = document.createElement("section");
    dayBlock.className = "day-block";
    dayBlock.innerHTML = `<div class="day-title">${date}</div>`;

    dayRows.forEach(r => {
      const base = { start: timeToMinutes(r.workStart), end: timeToMinutes(r.workEnd) };
      const normalBlocks = getLessonBlocks(r.normalLessons, lessons);
      const standardBlocks = getStandardBlocks(r.standard);
      const free = subtractIntervals(base, [...normalBlocks, ...standardBlocks].sort((a,b)=>a.start-b.start));

      const card = document.createElement("div");
      card.className = "teacher-card";
      card.innerHTML = `
        <div class="teacher-name">${r.teacher}</div>
        <div class="row"><div class="label">勤務可能</div><div class="value">${r.workStart}～${r.workEnd}</div></div>
        <div class="row"><div class="label">通常授業</div><div class="value">${r.normalLessons.length ? r.normalLessons.join("・") : "なし"}</div></div>
        <div class="row"><div class="label">STANDARD</div><div class="value">${r.standard.length ? r.standard.map((s,i)=>`${i+1}:${s.start}～${s.end}`).join("\n") : "なし"}</div></div>
        <div class="row"><div class="label">スタッフ可能</div><div class="value free">${formatIntervals(free)}</div></div>
      `;
      dayBlock.appendChild(card);
    });

    resultArea.appendChild(dayBlock);
  });
}

async function loadData() {
  statusBox.className = "status neutral";
  statusBox.textContent = "読み込み中です…";
  resultArea.innerHTML = "";
  try {
    const data = await jsonp("getLatest", { month: monthSelect.value });
    render(data);
    statusBox.className = "status success";
    statusBox.textContent = `${monthSelect.value} の最新提出を読み込みました。`;
  } catch(e) {
    console.error(e);
    statusBox.className = "status neutral";
    statusBox.textContent = "読み込みに失敗しました。";
  }
}

loadBtn.addEventListener("click", loadData);
setupMonths();
