import { createSaveFile, parseSaveFile, validatePlanner } from './save-format.mjs';

const PROGRESS_KEY = 'qc2-progress';
const PLANNER_KEY = 'qc2-study-plans';
const DEFAULT_PROGRESS = { sessions: 0, answered: 0, known: {}, practice: {}, assessments: {} };
const DEFAULT_PLANNER = { plans: [] };
const MAX_SAVE_SIZE = 5 * 1024 * 1024;
const savedIndicator = document.getElementById('savedIndicator');

if (!savedIndicator) {
  throw new Error('QuizCove kunde inte hitta kontrollerna för sparfilshantering.');
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

function addButton(id, label, title) {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = 'quiet';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  savedIndicator.insertAdjacentElement('afterend', button);
  return button;
}

const exportButton = addButton('exportSaveFile', 'Exportera sparfil', 'Ladda ner dina studieframsteg som sparfil');
const importButton = addButton('importSaveFile', 'Importera sparfil', 'Återställ studieframsteg från en sparfil');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,application/json';
fileInput.hidden = true;
fileInput.setAttribute('aria-label', 'Välj QuizCove-sparfil');
importButton.insertAdjacentElement('afterend', fileInput);

exportButton.addEventListener('click', () => {
  try {
    const storedProgress = localStorage.getItem(PROGRESS_KEY);
    const progress = storedProgress === null ? DEFAULT_PROGRESS : JSON.parse(storedProgress);
    const storedPlanner = localStorage.getItem(PLANNER_KEY);
    const planner = storedPlanner === null ? DEFAULT_PLANNER : validatePlanner(JSON.parse(storedPlanner));
    const content = JSON.stringify(createSaveFile(progress, planner), null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `quizcove-sparfil-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage('Sparfilen har laddats ner.');
  } catch (error) {
    showMessage(`Exporten misslyckades: ${error instanceof Error ? error.message : 'okänt fel'}`, true);
  }
});

importButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    if (file.size > MAX_SAVE_SIZE) {
      throw new Error('Sparfilen är större än 5 MB.');
    }

    const { progress, planner } = parseSaveFile(await file.text());
    if (!window.confirm('Importen ersätter sparade studieframsteg och studieplaner i den här webbläsaren. Vill du fortsätta?')) {
      return;
    }

    const previousProgress = localStorage.getItem(PROGRESS_KEY);
    const previousPlanner = localStorage.getItem(PLANNER_KEY);
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      localStorage.setItem(PLANNER_KEY, JSON.stringify(planner));
    } catch (error) {
      try {
        if (previousProgress === null) localStorage.removeItem(PROGRESS_KEY);
        else localStorage.setItem(PROGRESS_KEY, previousProgress);
        if (previousPlanner === null) localStorage.removeItem(PLANNER_KEY);
        else localStorage.setItem(PLANNER_KEY, previousPlanner);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Importen och återställningen av tidigare data misslyckades.');
      }
      throw error;
    }
    showMessage('Sparfilen har importerats. Sidan uppdateras …');
    window.setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    showMessage(`Importen misslyckades: ${error instanceof Error ? error.message : 'okänt fel'}`, true);
  } finally {
    fileInput.value = '';
  }
});
