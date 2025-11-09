// app.js — логика: загрузка плана, смена дня по УЗ (GMT+5), таймер до следующего события.
// Не содержит выбора Сделал/Не сделал (убрали).

const planContainer = document.getElementById("planContainer");
const nextEventTimer = document.getElementById("nextEventTimer");
const currentTimeEl = document.getElementById("currentTime");

let planData = null;

// Загрузка плана (data/plan.json)
fetch('data/plan.json')
  .then(r => r.json())
  .then(data => {
    // поддерживаем формат, который ты давал — корень growth_plan_month
    planData = data.growth_plan_month || data;
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

// Мэп дня недели -> ключ в JSON (твоя логика)
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

// Инициализация (рендер + таймер каждую секунду)
function initPlan() {
  renderDay();
  setInterval(() => {
    renderDay(); // обновляем статусы (прошёл/будет)
    updateTimer();
  }, 1000);
}

// Рендер текущего дня (с подсказками и карточками)
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
  day.schedule.forEach((item) => {
    // item.time could be "06:10–06:40" or "07:00"
    const timeStart = item.time.split('–')[0].trim();
    const [h, m] = timeStart.split(':').map(s => parseInt(s, 10) || 0);
    const eventTime = new Date(now);
    eventTime.setHours(h, m, 0, 0);

    // Determine class: upcoming or past
    const cls = eventTime > now ? 'upcoming' : 'past';

    html += `<div class="card ${cls}">
      <div class="left">
        <div class="time">${escapeHtml(item.time)}</div>
        <div class="activity-wrap"><div class="activity">${escapeHtml(item.activity)}</div></div>
      </div>
    </div>`;
  });
  html += `</div>`;

  planContainer.innerHTML = html;
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

// very small sanitizer for HTML injection safety
function escapeHtml(s){
  if(!s && s!==0) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
  