import assert from 'node:assert/strict';
import test from 'node:test';
import { createSaveFile, parseSaveFile } from './save-format.mjs';

const progress = {
  sessions: 3,
  answered: 12,
  known: { 'fc-math-numbers-year6-0': true },
  practice: { 'fc-math-numbers-year6-1': true },
  assessments: { 'math-question-1': 'correct' },
};

const planner = {
  plans: [{
    id: 'plan-1',
    title: 'Biologiprov',
    subject: 'Biologi',
    examDate: '2026-12-01',
    createdAt: '2026-11-15T13:00:00.000Z',
    tasks: [{
      id: 'task-1',
      title: 'Repetera celler',
      dueDate: '2026-11-20',
      minutes: 30,
      done: false,
    }],
  }],
};

test('save files round-trip local study progress and study plans', () => {
  const exportedAt = new Date('2026-11-15T13:00:00.000Z');
  const saved = createSaveFile(progress, planner, exportedAt);

  assert.equal(saved.format, 'quizcove-save');
  assert.equal(saved.version, 2);
  assert.equal(saved.exportedAt, exportedAt.toISOString());
  assert.deepEqual(parseSaveFile(JSON.stringify(saved)), { progress, planner });
});

test('save files reject invalid JSON, formats, and unsupported versions', () => {
  assert.throws(() => parseSaveFile('{'), /giltig JSON/);
  assert.throws(() => parseSaveFile(JSON.stringify({ format: 'other', version: 1 })), /inte en QuizCove/);
  assert.throws(
    () => parseSaveFile(JSON.stringify({ format: 'quizcove-save', version: 3 })),
    /version som inte stöds/,
  );
});

test('save files keep version-one progress and start with an empty planner', () => {
  const legacy = {
    format: 'quizcove-save',
    version: 1,
    exportedAt: '2026-11-15T13:00:00.000Z',
    progress,
  };

  const legacyProgress = { ...progress };
  delete legacyProgress.assessments;
  assert.deepEqual(parseSaveFile(JSON.stringify({ ...legacy, progress: legacyProgress })), {
    progress: { ...legacyProgress, assessments: {} },
    planner: { plans: [] },
  });
});

test('save files reject invalid progress and planner values', () => {
  assert.throws(() => createSaveFile({ ...progress, sessions: -1 }), /ogiltiga räknare/);
  assert.throws(() => createSaveFile({ ...progress, known: { card: 'yes' } }), /ogiltiga flashcard/);
  assert.throws(() => createSaveFile({ ...progress, assessments: { card: 'unknown' } }), /ogiltiga självbedömningar/);
  assert.throws(() => createSaveFile(progress, { plans: [{ ...planner.plans[0], examDate: '2026-02-30' }] }), /provdatum/);
  assert.throws(
    () => createSaveFile(progress, { plans: [{ ...planner.plans[0], tasks: [{ ...planner.plans[0].tasks[0], minutes: 0 }] }] }),
    /deadline/,
  );
});
