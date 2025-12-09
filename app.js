/* app.js — логика: загрузка плана, рендер, таймер, bottom-sheet деталей.
   Часы по Узбекистану (GMT+5) — как ты хотел.
*/

const planContainer = document.getElementById("planContainer");
const nextEventTimer = document.getElementById("nextEventTimer");
const currentTimeEl = document.getElementById("currentTime");

const bottomSheet = document.getElementById("bottomSheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetDetails = document.getElementById("sheetDetails");
const sheetClose = document.getElementById("sheetClose");
const sheetHandle = document.getElementById("sheetHandle");

let planData = null;
let detailsList = [];

// Загрузка плана
fetch('data/plan.json')
  .then(r => r.json())
  .then(data => {
    planData = data.growth_plan_month || data;
    detailsList = data.plan || [];
    initPlan();
  })
  .catch(err => {
    console.error('Ошибка загрузки plan.json', err);
    planContainer.innerHTML = "<p style='color:#f87171'>Ошибка загрузки плана</p>";
  });

// Получаем текущее время в Узбекистане (GMT+5)
function getUZTime() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + 5 * 3600000);
}

// Мэп дня недели -> ключ в JSON
function getDayKey() {
  const uz = getUZTime();
  const d = uz.getDay(); // 0..6, 0 = Sunday
  const map = [
    "sunday",
    "monday_wednesday_friday",
    "monday_wednesday_friday",
    "tuesday_thursday_saturday",
    "tuesday_thursday_saturday",
    "monday_wednesday_friday",
    "tuesday_thursday_saturday"
  ];
  return map[d];
}

// Инициализация
function initPlan() {
  renderDay();
  setInterval(() => {
    renderDay(); // обновляем статусы (прошёл/будет)
    updateTimer();
  }, 1000);
}

// Рендер текущего дня
function renderDay() {
  if (!planData) return;
  const dayKey = getDayKey();
  const day = planData.days && planData.days[dayKey];

  if (!day) {
    planContainer.innerHTML = `<p>Сегодня нет действий</p>`;
    return;
  }

  const now = getUZTime();
  let html = `<h2 style="margin:0 0 8px 0">${escapeHtml(planData.goal)}</h2>`;
  html += `<p style="margin:0 0 12px 0;color:#9ca3af">${escapeHtml(day.description || '')}</p>`;

  // Tips block
  const tips = Array.isArray(planData.nutrition_tips) ? planData.nutrition_tips : [];
  if (tips.length) {
    html += `<div class="tips">${tips.map(t => escapeHtml(t)).join('<br>')}</div>`;
  }

  // Cards
  html += `<div class="cards">`;
  day.schedule.forEach((item, idx) => {
    const timeStart = item.time.split('–')[0].trim();
    const [h, m] = timeStart.split(':').map(s => parseInt(s, 10) || 0);
    const eventTime = new Date(now);
    eventTime.setHours(h, m, 0, 0);

    const cls = eventTime > now ? 'upcoming' : 'past';

    // We attach data-index and data-activity for lookup
    html += `<div class="card ${cls}" data-activity="${escapeAttr(item.activity)}" data-idx="${idx}">
      <div class="left">
        <div class="time">${escapeHtml(item.time)}</div>
        <div class="activity-wrap"><div class="activity">${escapeHtml(item.activity)}</div></div>
      </div>
    </div>`;
  });
  html += `</div>`;

  planContainer.innerHTML = html;

  // Attach click events to new cards
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const activity = card.dataset.activity || '';
      const detailItem = findDetailForActivity(activity);
      if (detailItem) openDetails(detailItem);
      else openDetails({ title: activity, details: { "Инструкция": [ "Подробностей нет, просто следуй активности." ] } });
    });
  });
}

// Находим деталь, пытаясь сопоставить по вхождению title/type
function findDetailForActivity(activityText) {
  if (!detailsList || !detailsList.length) return null;
  // 1) точное совпадение title
  let found = detailsList.find(d => d.title && activityText.toLowerCase() === d.title.toLowerCase());
  if (found) return found;
  // 2) вхождение: если activity содержит часть title или title содержит часть activity
  found = detailsList.find(d => {
    return (d.title && activityText.toLowerCase().includes(d.title.toLowerCase()))
      || (d.title && d.title.toLowerCase().includes(activityText.toLowerCase()))
      || (d.type && activityText.toLowerCase().includes(d.type.toLowerCase()));
  });
  if (found) return found;
  // 3) попробуем сопоставить по ключевым словам: training, english, food, swimming
  const keywords = ['тренировка','training','англи','english','пит','food','бассейн','swim'];
  for (const k of keywords) {
    const f = detailsList.find(d => (d.title && d.title.toLowerCase().includes(k)) || (d.type && d.type.toLowerCase().includes(k)));
    if (f) return f;
  }
  return null;
}

// Обновление таймера до следующего события
function updateTimer() {
  if (!planData) return;
  const now = getUZTime();
  currentTimeEl.textContent = now.toTimeString().slice(0,5);

  const dayKey = getDayKey();
  const day = planData.days && planData.days[dayKey];
  if (!day) {
    nextEventTimer.textContent = '--:--:--';
    return;
  }

  let nextEvent = null;
  for (let i = 0; i < day.schedule.length; i++) {
    const item = day.schedule[i];
    const timeStart = item.time.split('–')[0].trim();
    const [h, m] = timeStart.split(':').map(s => parseInt(s,10) || 0);
    const ev = new Date(now);
    ev.setHours(h, m, 0, 0);
    if (ev > now) { nextEvent = ev; break; }
  }

  if (!nextEvent) {
    nextEventTimer.textContent = 'Все завершено';
    return;
  }

  const diff = nextEvent - now;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  nextEventTimer.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function pad(n){ return n.toString().padStart(2,'0'); }

// Bottom sheet functions
function openDetails(item) {
  sheetTitle.textContent = item.title || 'Детали';
  let html = '';
  if (item.details && typeof item.details === 'object') {
    for (const section in item.details) {
      const arr = item.details[section];
      if (Array.isArray(arr)) {
        html += `<h3>${escapeHtml(section)}</h3><ul>`;
        arr.forEach(x => html += `<li>${escapeHtml(x)}</li>`);
        html += `</ul>`;
      } else {
        html += `<h3>${escapeHtml(section)}</h3><p>${escapeHtml(String(arr))}</p>`;
      }
    }
  } else {
    html = `<p>Инструкции отсутствуют.</p>`;
  }
  sheetDetails.innerHTML = html;
  bottomSheet.classList.add('active');
  bottomSheet.setAttribute('aria-hidden', 'false');
  // prevent background scroll on some browsers
  document.body.style.touchAction = 'none';
}

sheetClose.onclick = closeSheet;
bottomSheet.onclick = (e) => {
  // close when clicking on backdrop area (sheet itself)
  if (e.target === bottomSheet) closeSheet();
};

function closeSheet() {
  bottomSheet.classList.remove('active');
  bottomSheet.setAttribute('aria-hidden', 'true');
  document.body.style.touchAction = '';
}

// Simple swipe-down to close (touch)
let touchStartY = 0;
let touchCurrentY = 0;
let sheetOpen = false;

sheetHandle.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
  sheetOpen = bottomSheet.classList.contains('active');
});
sheetHandle.addEventListener('touchmove', (e) => {
  touchCurrentY = e.touches[0].clientY;
  const delta = touchCurrentY - touchStartY;
  if (delta > 6 && sheetOpen) {
    // move sheet visually (small translate)
    bottomSheet.style.transform = `translateY(${delta}px)`;
  }
});
sheetHandle.addEventListener('touchend', (e) => {
  const delta = touchCurrentY - touchStartY;
  bottomSheet.style.transform = '';
  if (delta > 80 && sheetOpen) {
    closeSheet();
  }
  touchStartY = touchCurrentY = 0;
});

// helpers
function escapeHtml(s){
  if(!s && s!==0) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
function escapeAttr(s){ return escapeHtml(s).replaceAll('"','&quot;'); }
