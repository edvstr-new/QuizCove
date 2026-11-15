import { validatePlanner } from './save-format.mjs';

const PLANNER_KEY = 'qc2-study-plans';
const app = document.getElementById('app');
const savedIndicator = document.getElementById('savedIndicator');
const plannerButton = document.createElement('button');

plannerButton.id = 'plannerTop';
plannerButton.type = 'button';
plannerButton.className = 'quiet';
plannerButton.textContent = 'Studieplan';
plannerButton.addEventListener('click', () => {
  document.dispatchEvent(new Event('quizcove:open-planner'));
});
savedIndicator.insertAdjacentElement('afterend', plannerButton);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showMessage(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) {
    window.alert(message);
    return;
  }
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showMessage.timeout);
  showMessage.timeout = window.setTimeout(() => toast.classList.remove('show'), 6000);
}

function readPlans() {
  const stored = localStorage.getItem(PLANNER_KEY);
  if (stored === null) return [];
  return validatePlanner(JSON.parse(stored)).plans;
}

function savePlans(plans) {
  const validated = validatePlanner({ plans });
  localStorage.setItem(PLANNER_KEY, JSON.stringify(validated));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function daysUntil(value) {
  const target = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - todayUtc) / 86_400_000);
}

function examCountdown(value) {
  const days = daysUntil(value);
  if (days < 0) return `Passerat för ${Math.abs(days)} dagar sedan`;
  if (days === 0) return 'Prov idag';
  if (days === 1) return 'Prov imorgon';
  return `${days} dagar kvar`;
}

function renderTask(task, planId) {
  const due = task.dueDate ? `Deadline ${formatDate(task.dueDate)}` : 'Ingen deadline';
  return `<li class="planner-task">
    <input type="checkbox" data-action="toggle-task" data-plan-id="${escapeHtml(planId)}" data-task-id="${escapeHtml(task.id)}" ${task.done ? 'checked' : ''} aria-label="${task.done ? 'Markera som inte klar' : 'Markera som klar'}: ${escapeHtml(task.title)}">
    <span><span class="planner-task-title ${task.done ? 'done' : ''}">${escapeHtml(task.title)}</span><span class="planner-task-meta">${due} · ${task.minutes} min</span></span>
    <button class="quiet" type="button" data-action="delete-task" data-plan-id="${escapeHtml(planId)}" data-task-id="${escapeHtml(task.id)}" aria-label="Ta bort uppgiften ${escapeHtml(task.title)}">Ta bort</button>
  </li>`;
}

function renderPlan(plan) {
  const completed = plan.tasks.filter((task) => task.done).length;
  const minutes = plan.tasks.reduce((total, task) => total + task.minutes, 0);
  const percentage = plan.tasks.length ? Math.round((completed / plan.tasks.length) * 100) : 0;
  const tasks = plan.tasks.length
    ? `<ul class="planner-task-list">${plan.tasks.map((task) => renderTask(task, plan.id)).join('')}</ul>`
    : '<div class="planner-empty-state">Lägg till din första plugguppgift här.</div>';

  return `<article class="planner-plan">
    <div class="planner-plan-head">
      <div><div class="eyebrow">${escapeHtml(formatDate(plan.examDate))} · ${escapeHtml(examCountdown(plan.examDate))}</div><h3>${escapeHtml(plan.title)}</h3><span class="planner-plan-subject">${escapeHtml(plan.subject)}</span></div>
      <button class="quiet" type="button" data-action="delete-plan" data-plan-id="${escapeHtml(plan.id)}" aria-label="Ta bort studieplanen ${escapeHtml(plan.title)}">Ta bort plan</button>
    </div>
    <div class="planner-plan-meta"><span>${completed} av ${plan.tasks.length} uppgifter klara</span><span>${minutes} min planerad studietid</span></div>
    <progress class="planner-progress" max="100" value="${percentage}" aria-label="Planen är ${percentage} procent klar"></progress>
    <form class="planner-task-form" data-plan-id="${escapeHtml(plan.id)}">
      <div class="field"><label for="task-title-${escapeHtml(plan.id)}">Plugguppgift</label><input id="task-title-${escapeHtml(plan.id)}" name="title" required maxlength="120" placeholder="Till exempel: repetera fotosyntes"></div>
      <div class="field"><label for="task-date-${escapeHtml(plan.id)}">Deadline (valfritt)</label><input id="task-date-${escapeHtml(plan.id)}" name="dueDate" type="date"></div>
      <div class="field"><label for="task-minutes-${escapeHtml(plan.id)}">Tid i minuter</label><input id="task-minutes-${escapeHtml(plan.id)}" name="minutes" type="number" min="5" max="480" step="5" value="30" required></div>
      <button class="secondary" type="submit">Lägg till uppgift</button>
    </form>
    ${tasks}
  </article>`;
}

function renderPlanner() {
  let plans;
  try {
    plans = readPlans().sort((first, second) => first.examDate.localeCompare(second.examDate));
  } catch (error) {
    app.innerHTML = `<section class="panel" role="alert"><h2>Studieplanerna kunde inte läsas</h2><p class="muted">${escapeHtml(error.message)}</p><button class="secondary" id="plannerHome">Till startsidan</button></section>`;
    document.getElementById('plannerHome').addEventListener('click', () => document.getElementById('homeBtn').click());
    return;
  }

  const planContent = plans.length
    ? `<div class="planner-list">${plans.map(renderPlan).join('')}</div>`
    : '<section class="panel planner-empty">Du har inga studieplaner ännu. Skapa en plan för ditt nästa prov.</section>';

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  app.innerHTML = `<section class="panel planner-intro">
    <div class="panel-header"><div><div class="eyebrow">STUDIEPLAN · SPARAS PÅ DEN HÄR ENHETEN</div><h2>Planera inför ett prov</h2><p class="muted">Skapa en plan, dela upp plugget i tydliga uppgifter och följ din utveckling fram till provdagen. Dina planer kräver inget konto.</p></div><button class="quiet" id="plannerHome">← Tillbaka</button></div>
    <form id="createPlanForm" class="planner-create-grid">
      <div class="field"><label for="planTitle">Vad ska du plugga till?</label><input id="planTitle" name="title" required maxlength="120" placeholder="Till exempel: Biologiprov"></div>
      <div class="field"><label for="planSubject">Ämne</label><input id="planSubject" name="subject" required maxlength="80" placeholder="Till exempel: Biologi"></div>
      <div class="field"><label for="planExamDate">Provdatum</label><input id="planExamDate" name="examDate" type="date" min="${localToday}" required></div>
      <button class="primary" type="submit">Skapa studieplan</button>
    </form>
  </section>${planContent}`;

  document.getElementById('plannerHome').addEventListener('click', () => document.getElementById('homeBtn').click());
}

function updatePlans(change) {
  try {
    savePlans(change(readPlans()));
    renderPlanner();
  } catch (error) {
    showMessage(`Studieplanen kunde inte sparas: ${error.message}`, true);
  }
}

app.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.id === 'createPlanForm') {
    event.preventDefault();
    const formData = new FormData(form);
    const plan = {
      id: createId(),
      title: formData.get('title').trim(),
      subject: formData.get('subject').trim(),
      examDate: formData.get('examDate'),
      createdAt: new Date().toISOString(),
      tasks: [],
    };
    updatePlans((plans) => [...plans, plan]);
    return;
  }

  if (!form.matches('.planner-task-form')) return;
  event.preventDefault();
  const formData = new FormData(form);
  const planId = form.dataset.planId;
  const task = {
    id: createId(),
    title: formData.get('title').trim(),
    dueDate: formData.get('dueDate'),
    minutes: Number(formData.get('minutes')),
    done: false,
  };
  updatePlans((plans) => plans.map((plan) => (
    plan.id === planId ? { ...plan, tasks: [...plan.tasks, task] } : plan
  )));
});

app.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-action="toggle-task"]');
  if (!checkbox) return;
  const { planId, taskId } = checkbox.dataset;
  updatePlans((plans) => plans.map((plan) => (
    plan.id === planId
      ? { ...plan, tasks: plan.tasks.map((task) => task.id === taskId ? { ...task, done: checkbox.checked } : task) }
      : plan
  )));
});

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, planId, taskId } = button.dataset;

  if (action === 'delete-plan') {
    let plan;
    try {
      plan = readPlans().find((item) => item.id === planId);
    } catch (error) {
      showMessage(`Studieplanen kunde inte läsas: ${error.message}`, true);
      return;
    }
    if (!plan || !window.confirm(`Ta bort studieplanen "${plan.title}" och alla dess uppgifter?`)) return;
    updatePlans((plans) => plans.filter((item) => item.id !== planId));
  } else if (action === 'delete-task') {
    updatePlans((plans) => plans.map((plan) => (
      plan.id === planId ? { ...plan, tasks: plan.tasks.filter((task) => task.id !== taskId) } : plan
    )));
  }
});

document.addEventListener('quizcove:open-planner', renderPlanner);
