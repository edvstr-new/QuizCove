export const SAVE_FORMAT = 'quizcove-save';
export const SAVE_VERSION = 2;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const EMPTY_PLANNER = { plans: [] };

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Studieplanen innehåller ett ogiltigt fält: ${field}.`);
  }
  return value.trim();
}

function validateProgress(progress) {
  if (!isRecord(progress)) {
    throw new Error('Sparfilen saknar giltiga studieframsteg.');
  }

  for (const field of ['sessions', 'answered']) {
    if (!Number.isSafeInteger(progress[field]) || progress[field] < 0) {
      throw new Error('Sparfilen innehåller ogiltiga räknare för studieframsteg.');
    }
  }

  const maps = {};
  for (const field of ['known', 'practice']) {
    const values = progress[field];
    if (!isRecord(values) || Object.entries(values).some(([key, value]) => !key || typeof value !== 'boolean')) {
      throw new Error('Sparfilen innehåller ogiltiga flashcard-framsteg.');
    }
    maps[field] = Object.fromEntries(Object.entries(values));
  }

  const assessments = progress.assessments ?? {};
  const validAssessments = new Set(['correct', 'answer', 'method', 'retry', 'strong', 'mostly', 'partial']);
  if (
    !isRecord(assessments) ||
    Object.entries(assessments).some(([key, value]) => !key || !validAssessments.has(value))
  ) {
    throw new Error('Sparfilen innehåller ogiltiga självbedömningar.');
  }

  return {
    sessions: progress.sessions,
    answered: progress.answered,
    known: maps.known,
    practice: maps.practice,
    assessments: Object.fromEntries(Object.entries(assessments)),
  };
}

export function validatePlanner(planner = EMPTY_PLANNER) {
  if (!isRecord(planner) || !Array.isArray(planner.plans) || planner.plans.length > 100) {
    throw new Error('Sparfilen innehåller ogiltiga studieplaner.');
  }

  const planIds = new Set();
  const plans = planner.plans.map((plan) => {
    if (!isRecord(plan) || !Array.isArray(plan.tasks) || plan.tasks.length > 500) {
      throw new Error('En studieplan innehåller ogiltiga uppgifter.');
    }

    const id = requireText(plan.id, 'id', 120);
    if (planIds.has(id)) throw new Error('Sparfilen innehåller dubbla studieplaner.');
    planIds.add(id);

    if (!isDateOnly(plan.examDate) || typeof plan.createdAt !== 'string' || !Number.isFinite(Date.parse(plan.createdAt))) {
      throw new Error('Studieplanen innehåller ett ogiltigt provdatum eller skapandedatum.');
    }

    const taskIds = new Set();
    const tasks = plan.tasks.map((task) => {
      if (!isRecord(task)) throw new Error('Studieplanen innehåller en ogiltig uppgift.');

      const taskId = requireText(task.id, 'uppgifts-id', 120);
      if (taskIds.has(taskId)) throw new Error('Studieplanen innehåller dubbla uppgifter.');
      taskIds.add(taskId);

      if (
        !Number.isSafeInteger(task.minutes) ||
        task.minutes < 5 ||
        task.minutes > 480 ||
        typeof task.done !== 'boolean' ||
        (task.dueDate !== '' && !isDateOnly(task.dueDate))
      ) {
        throw new Error('Studieplanen innehåller ogiltig tid, status eller deadline.');
      }

      return {
        id: taskId,
        title: requireText(task.title, 'uppgiftstitel', 120),
        dueDate: task.dueDate,
        minutes: task.minutes,
        done: task.done,
      };
    });

    return {
      id,
      title: requireText(plan.title, 'provtitel', 120),
      subject: requireText(plan.subject, 'ämne', 80),
      examDate: plan.examDate,
      createdAt: plan.createdAt,
      tasks,
    };
  });

  return { plans };
}

export function createSaveFile(progress, planner = EMPTY_PLANNER, exportedAt = new Date()) {
  if (!(exportedAt instanceof Date) || !Number.isFinite(exportedAt.getTime())) {
    throw new Error('Exportdatumet är ogiltigt.');
  }

  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    exportedAt: exportedAt.toISOString(),
    progress: validateProgress(progress),
    planner: validatePlanner(planner),
  };
}

export function parseSaveFile(contents) {
  let saveFile;
  try {
    saveFile = JSON.parse(contents);
  } catch {
    throw new Error('Filen innehåller inte giltig JSON.');
  }

  if (!isRecord(saveFile) || saveFile.format !== SAVE_FORMAT) {
    throw new Error('Filen är inte en QuizCove-sparfil.');
  }
  if (saveFile.version !== 1 && saveFile.version !== SAVE_VERSION) {
    throw new Error('Sparfilen har en version som inte stöds.');
  }
  if (typeof saveFile.exportedAt !== 'string' || !Number.isFinite(Date.parse(saveFile.exportedAt))) {
    throw new Error('Sparfilen saknar ett giltigt exportdatum.');
  }

  return {
    progress: validateProgress(saveFile.progress),
    planner: saveFile.version === 1 ? { plans: [] } : validatePlanner(saveFile.planner),
  };
}
