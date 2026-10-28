import { describe, expect, it } from 'vitest';
import {
  canFinish,
  emptyProgress,
  exercisesOf,
  finishLesson,
  hasCompleted,
  isUnlocked,
  mergeProgress,
  nextLesson,
  reviewLessons,
  runScore,
  skillStats,
  type Attempt,
  type Completion,
  type LessonState,
  type Progress,
} from './progress';
import { parseProgress } from './validation';
import type { Lesson, SkillId } from './types';

const at = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();

function lesson(
  id: string,
  moduleId = 'm1',
  count = 4,
  exam = false,
  skills: SkillId[] = ['mathematics'],
): Lesson {
  return {
    id,
    version: 1,
    moduleId,
    title: id,
    subtitle: 'Учебный материал',
    objective: 'Научиться считать',
    minutes: 10,
    skills,
    exam,
    terms: [],
    blocks: [
      { id: `${id}-theory`, type: 'text', title: 'Теория', paragraphs: ['Объяснение'] },
      ...Array.from({ length: count }, (_, index) => ({
        id: `${id}-block-${index}`,
        type: 'exercise' as const,
        exercise: {
          id: `${id}-q-${index}`,
          kind: 'numeric' as const,
          prompt: 'Сколько?',
          expected: index + 1,
          unit: 'number' as const,
          hint: 'Проверьте расчёт',
          explanation: 'Решение',
          skills,
        },
      })),
      { id: `${id}-summary`, type: 'summary', title: 'Итоги', points: ['Запомнить принцип'] },
    ],
  };
}

function state(runId = crypto.randomUUID(), second = 0): LessonState {
  return { position: 0, runId, drafts: {}, updatedAt: at(second) };
}

function progressWithState(content: Lesson, runId = crypto.randomUUID()): Progress {
  return { ...emptyProgress(), states: { [content.id]: state(runId) } };
}

function attempt(
  content: Lesson,
  index: number,
  runId: string,
  correct: boolean,
  second = index,
): Attempt {
  return {
    id: crypto.randomUUID(),
    lessonId: content.id,
    exerciseId: exercisesOf(content)[index].id,
    runId,
    answer: correct ? String(index + 1) : '0',
    correct,
    at: at(second),
  };
}

function completion(content: Lesson, runId = crypto.randomUUID(), score = 100): Completion {
  return { lessonId: content.id, version: content.version, runId, score, completedAt: at(50) };
}

function solve(content: Lesson, progress: Progress, firstCorrect: boolean[]): Progress {
  const runId = progress.states[content.id].runId;
  return {
    ...progress,
    attempts: [
      ...progress.attempts,
      ...firstCorrect.map((correct, index) => attempt(content, index, runId, correct, index)),
      ...firstCorrect.flatMap((correct, index) =>
        correct ? [] : [attempt(content, index, runId, true, 20 + index)],
      ),
    ],
  };
}

describe('mandatory practice and lesson completion', () => {
  it('extracts exercises without treating theory and summary as graded blocks', () => {
    const content = lesson('basics');
    expect(exercisesOf(content)).toHaveLength(4);
    expect(exercisesOf(content).every((exercise) => exercise.kind === 'numeric')).toBe(true);
  });

  it('does not let a saved position, partial answers, another lesson or another run bypass practice', () => {
    const content = lesson('basics');
    const progress = progressWithState(content);
    const runId = progress.states[content.id].runId;
    progress.states[content.id].position = content.blocks.length - 1;
    expect(canFinish(content, progress, runId)).toBe(false);
    progress.attempts = [0, 1, 2].map((index) => attempt(content, index, runId, true));
    progress.attempts.push(attempt(content, 3, crypto.randomUUID(), true));
    progress.attempts.push({ ...attempt(content, 3, runId, true), lessonId: 'another-lesson' });
    expect(canFinish(content, progress, runId)).toBe(false);
    expect(finishLesson(content, progress)).toBe(progress);
    progress.attempts.push(attempt(content, 3, runId, false));
    expect(canFinish(content, progress, runId)).toBe(false);
    progress.attempts.push(attempt(content, 3, runId, true, 30));
    expect(canFinish(content, progress, runId)).toBe(true);
  });

  it('completes a run once, preserves the original state and scores first answers rather than corrected guesses', () => {
    const content = lesson('basics');
    const progress = solve(content, progressWithState(content), [true, false, false, true]);
    const original = JSON.stringify(progress);
    const finished = finishLesson(content, progress);
    expect(finished.completions).toHaveLength(1);
    expect(finished.completions[0]).toMatchObject({
      lessonId: content.id,
      version: 1,
      score: 50,
      runId: progress.states[content.id].runId,
    });
    expect(hasCompleted(finished, content)).toBe(true);
    expect(JSON.stringify(progress)).toBe(original);
    expect(finishLesson(content, finished)).toBe(finished);
    expect(finishLesson(content, finished).completions).toHaveLength(1);
  });

  it('requires an active run state and permits a genuine new run without duplicating the previous one', () => {
    const content = lesson('basics');
    expect(finishLesson(content, emptyProgress()).completions).toEqual([]);
    const first = finishLesson(
      content,
      solve(content, progressWithState(content), [true, true, true, true]),
    );
    const newRun = { ...first, states: { ...first.states, [content.id]: state() } };
    const second = finishLesson(content, solve(content, newRun, [true, true, true, true]));
    expect(second.completions).toHaveLength(2);
    expect(new Set(second.completions.map((value) => value.runId)).size).toBe(2);
  });

  it('counts missing first answers as incorrect and orders answers deterministically by timestamp then id', () => {
    const content = lesson('scoring');
    const progress = progressWithState(content);
    const runId = progress.states[content.id].runId;
    const first = {
      ...attempt(content, 0, runId, false, 1),
      id: '00000000-0000-4000-8000-000000000001',
    };
    const second = {
      ...attempt(content, 0, runId, true, 1),
      id: '00000000-0000-4000-8000-000000000002',
    };
    progress.attempts = [second, attempt(content, 1, runId, true, 2), first];
    expect(runScore(content, progress, runId)).toBe(25);
    expect(runScore(content, progress, crypto.randomUUID())).toBe(0);
  });
});

describe('exam threshold and content versions', () => {
  it('records a failed exam honestly and requires at least 70% first-attempt accuracy to pass', () => {
    const exam = lesson('exam', 'm1', 10, true);
    const failed = finishLesson(
      exam,
      solve(
        exam,
        progressWithState(exam),
        Array.from({ length: 10 }, (_, index) => index < 6),
      ),
    );
    expect(failed.completions[0].score).toBe(60);
    expect(hasCompleted(failed, exam)).toBe(false);
    const passed = finishLesson(
      exam,
      solve(
        exam,
        progressWithState(exam),
        Array.from({ length: 10 }, (_, index) => index < 7),
      ),
    );
    expect(passed.completions[0].score).toBe(70);
    expect(hasCompleted(passed, exam)).toBe(true);
  });

  it('invalidates completion when the lesson or exam content version changes', () => {
    const content = lesson('basics');
    const exam = lesson('exam', 'm1', 10, true);
    const progress = emptyProgress();
    progress.completions = [completion(content), completion(exam)];
    expect(hasCompleted(progress, content)).toBe(true);
    expect(hasCompleted(progress, exam)).toBe(true);
    expect(hasCompleted(progress, { ...content, version: 2 })).toBe(false);
    expect(hasCompleted(progress, { ...exam, version: 2 })).toBe(false);
  });

  it('does not reuse completed practice or mastery while the saved state belongs to an old content version', () => {
    const content = lesson('versioned', 'm1', 2);
    const progress = solve(content, progressWithState(content), [true, true]);
    const runId = progress.states[content.id].runId;
    const updated = { ...content, version: 2 };
    expect(canFinish(content, progress, runId)).toBe(true);
    expect(canFinish(updated, progress, runId)).toBe(false);
    expect(finishLesson(updated, progress)).toBe(progress);
    expect(skillStats('mathematics', [updated], progress)).toEqual({
      mastery: 0,
      accuracy: 0,
      assessed: 0,
      total: 2,
    });
  });

  it('does not resurrect old-version mastery after the UI resets the lesson to a new-version run', () => {
    const content = lesson('version-reset', 'm1', 2);
    const progress = finishLesson(
      content,
      solve(content, progressWithState(content), [true, true]),
    );
    const oldRun = progress.states[content.id].runId;
    const updated = { ...content, version: 2 };
    progress.states[content.id] = { ...state(), contentVersion: 2 };
    const newRun = progress.states[content.id].runId;
    expect(canFinish(updated, progress, newRun)).toBe(false);
    expect(canFinish(updated, progress, oldRun)).toBe(false);
    expect(skillStats('mathematics', [updated], progress)).toEqual({
      mastery: 0,
      accuracy: 0,
      assessed: 0,
      total: 2,
    });
    const newEvidence: Attempt & { contentVersion: number } = {
      ...attempt(updated, 0, newRun, true, 59),
      contentVersion: 2,
    };
    progress.attempts.push(newEvidence);
    expect(skillStats('mathematics', [updated], progress)).toEqual({
      mastery: 50,
      accuracy: 100,
      assessed: 1,
      total: 2,
    });
  });

  it('ignores old-version attempts when scoring a new version and building its review queue', () => {
    const original = lesson('versioned-review', 'm1', 1);
    const progress = progressWithState(original);
    const oldRun = progress.states[original.id].runId;
    progress.attempts = [
      attempt(original, 0, oldRun, false, 1),
      attempt(original, 0, oldRun, true, 2),
    ];
    const updated = { ...original, version: 2 };
    progress.states[updated.id] = { ...state(), contentVersion: 2 };
    expect(runScore(updated, progress, oldRun)).toBe(0);
    expect(reviewLessons([updated], progress)).toEqual([]);
    const newRun = progress.states[updated.id].runId;
    const newWrong: Attempt & { contentVersion: number } = {
      ...attempt(updated, 0, newRun, false, 10),
      contentVersion: 2,
    };
    const newCorrect: Attempt & { contentVersion: number } = {
      ...attempt(updated, 0, newRun, true, 11),
      contentVersion: 2,
    };
    progress.attempts.push(newWrong, newCorrect);
    expect(canFinish(updated, progress, newRun)).toBe(true);
    expect(runScore(updated, progress, newRun)).toBe(0);
    expect(skillStats('mathematics', [updated], progress)).toEqual({
      mastery: 0,
      accuracy: 0,
      assessed: 1,
      total: 1,
    });
    expect(reviewLessons([updated], progress).map((item) => item.id)).toEqual([updated.id]);
  });
});

describe('educational path unlock rules', () => {
  const modules = ['m1', 'm2', 'm3'].flatMap((moduleId) => [
    ...Array.from({ length: 6 }, (_, index) => lesson(`${moduleId}-lesson-${index}`, moduleId)),
    lesson(`${moduleId}-exam`, moduleId, 6, true),
  ]);

  it('makes the first lesson of every module public while keeping subsequent lessons and exams locked', () => {
    const progress = emptyProgress();
    for (const moduleId of ['m1', 'm2', 'm3']) {
      expect(
        isUnlocked(
          modules.find((item) => item.id === `${moduleId}-lesson-0`)!,
          modules,
          progress,
        ),
      ).toBe(true);
      expect(
        isUnlocked(
          modules.find((item) => item.id === `${moduleId}-lesson-1`)!,
          modules,
          progress,
        ),
      ).toBe(false);
      expect(
        isUnlocked(
          modules.find((item) => item.id === `${moduleId}-exam`)!,
          modules,
          progress,
        ),
      ).toBe(false);
    }
  });

  it('requires all preceding lessons and all six module lessons for an exam, independently of other modules', () => {
    const progress = emptyProgress();
    const peers = modules.filter((item) => item.moduleId === 'm2' && !item.exam);
    progress.completions = peers.slice(0, 5).map((item) => completion(item));
    const sixth = peers[5];
    const exam = modules.find((item) => item.id === 'm2-exam')!;
    expect(isUnlocked(sixth, modules, progress)).toBe(true);
    expect(isUnlocked(exam, modules, progress)).toBe(false);
    progress.completions.push(completion(sixth));
    expect(isUnlocked(exam, modules, progress)).toBe(true);
    expect(
      isUnlocked(
        modules.find((item) => item.id === 'm1-exam')!,
        modules,
        progress,
      ),
    ).toBe(false);
    expect(isUnlocked({ ...peers[1], version: 2 }, modules, progress)).toBe(true);
    expect(
      isUnlocked(
        { ...exam, version: 2 },
        modules.map((item) => (item.id === sixth.id ? { ...item, version: 2 } : item)),
        progress,
      ),
    ).toBe(false);
  });

  it('always permits revisiting a completed lesson', () => {
    const content = modules[4];
    const progress = { ...emptyProgress(), completions: [completion(content)] };
    expect(isUnlocked(content, modules, progress)).toBe(true);
  });
});

describe('progress persistence and safe merging', () => {
  it('restores the precise lesson position, run, draft answers, preferences and assessed results after JSON serialization', () => {
    const content = lesson('persist');
    const progress = solve(content, progressWithState(content), [true, false, true, true]);
    progress.states[content.id].position = 4;
    progress.states[content.id].drafts = {
      numeric: '7,5',
      choice: ['a', 'c'],
      matching: { asset: 'asset', liability: 'liability' },
    };
    progress.preferences = {
      ...progress.preferences,
      onboardingDone: true,
      goal: 'Инвестиции',
      pace: 30,
      diagnosticScore: 75,
      recommendedLesson: content.id,
    };
    progress.preferencesUpdatedAt = at(40);
    const finished = finishLesson(content, progress);
    const restored = parseProgress(JSON.parse(JSON.stringify(finished)));
    expect(restored).toEqual(finished);
    expect(restored).not.toBe(finished);
    expect(restored?.states[content.id].position).toBe(4);
    expect(restored?.states[content.id].drafts.numeric).toBe('7,5');
    expect(restored?.states[content.id].runId).toBe(progress.states[content.id].runId);
    expect(hasCompleted(restored!, content)).toBe(true);
    expect(runScore(content, restored!, progress.states[content.id].runId)).toBe(75);
  });

  it('deduplicates immutable attempts and run completions while keeping canonical server records', () => {
    const content = lesson('merge');
    const server = progressWithState(content);
    const runId = server.states[content.id].runId;
    const canonicalAttempt = attempt(content, 0, runId, false);
    const canonicalCompletion = completion(content, runId, 25);
    server.attempts = [canonicalAttempt];
    server.completions = [canonicalCompletion];
    const incoming = {
      ...emptyProgress(),
      attempts: [{ ...canonicalAttempt, correct: true }, attempt(content, 1, runId, true)],
      completions: [{ ...canonicalCompletion, score: 100 }, completion(content)],
    };
    const beforeServer = JSON.stringify(server);
    const beforeIncoming = JSON.stringify(incoming);
    const merged = mergeProgress(server, incoming);
    expect(merged.sourceId).toBe(server.sourceId);
    expect(merged.attempts).toHaveLength(2);
    expect(merged.attempts.find((item) => item.id === canonicalAttempt.id)?.correct).toBe(false);
    expect(merged.completions).toHaveLength(2);
    expect(merged.completions.find((item) => item.runId === runId)?.score).toBe(25);
    expect(mergeProgress(merged, incoming)).toEqual(merged);
    expect(mergeProgress(merged, merged)).toEqual(merged);
    expect(JSON.stringify(server)).toBe(beforeServer);
    expect(JSON.stringify(incoming)).toBe(beforeIncoming);
  });

  it('chooses the newest mutable state per lesson and newest preference record, keeping server ties', () => {
    const server = emptyProgress();
    server.states = {
      olderIncoming: state(undefined, 20),
      newerIncoming: state(undefined, 10),
      equal: state(undefined, 20),
    };
    server.preferencesUpdatedAt = at(10);
    const incoming = emptyProgress();
    incoming.states = {
      olderIncoming: { ...state(undefined, 10), position: 3 },
      newerIncoming: { ...state(undefined, 20), position: 4 },
      equal: { ...state(undefined, 20), position: 5 },
      added: state(undefined, 1),
    };
    incoming.preferences = {
      ...incoming.preferences,
      goal: 'Финансовый английский',
      onboardingDone: true,
    };
    incoming.preferencesUpdatedAt = at(20);
    const merged = mergeProgress(server, incoming);
    expect(merged.states.olderIncoming).toEqual(server.states.olderIncoming);
    expect(merged.states.newerIncoming.position).toBe(4);
    expect(merged.states.equal).toEqual(server.states.equal);
    expect(merged.states.added).toEqual(incoming.states.added);
    expect(merged.preferences).toEqual(incoming.preferences);
    expect(
      mergeProgress(server, { ...incoming, preferencesUpdatedAt: server.preferencesUpdatedAt })
        .preferences,
    ).toEqual(server.preferences);
  });

  it('compares instants rather than timestamp strings when offsets differ in states and preferences', () => {
    const newer = emptyProgress();
    newer.preferences = { ...newer.preferences, goal: 'Более новая цель' };
    newer.preferencesUpdatedAt = '2026-01-01T08:00:00Z';
    newer.states.shared = { ...state(), position: 4, updatedAt: '2026-01-01T08:00:00Z' };
    const older = emptyProgress();
    older.preferences = { ...older.preferences, goal: 'Более старая цель' };
    older.preferencesUpdatedAt = '2026-01-01T12:00:00+05:00'; // 07:00 UTC, before 08:00 UTC.
    older.states.shared = { ...state(), position: 2, updatedAt: '2026-01-01T12:00:00+05:00' };
    expect(parseProgress(newer)).not.toBeNull();
    expect(parseProgress(older)).not.toBeNull();
    for (const merged of [mergeProgress(newer, older), mergeProgress(older, newer)]) {
      expect(merged.preferences).toEqual(newer.preferences);
      expect(merged.states.shared).toEqual(newer.states.shared);
    }
  });
});

describe('skill mastery evidence', () => {
  it('counts each exercise once, uses the latest run and keeps first wrong answers wrong despite correction', () => {
    const content = lesson('mastery', 'm1', 2);
    const progress = progressWithState(content);
    const oldRun = progress.states[content.id].runId;
    progress.attempts = [
      attempt(content, 0, oldRun, false, 0),
      attempt(content, 0, oldRun, true, 1),
      attempt(content, 0, oldRun, true, 2),
    ];
    expect(skillStats('mathematics', [content], progress)).toEqual({
      mastery: 0,
      accuracy: 0,
      assessed: 1,
      total: 2,
    });
    const newRun = crypto.randomUUID();
    progress.attempts.push(
      attempt(content, 0, newRun, true, 10),
      attempt(content, 0, newRun, true, 11),
    );
    expect(skillStats('mathematics', [content], progress)).toEqual({
      mastery: 50,
      accuracy: 100,
      assessed: 1,
      total: 2,
    });
    progress.attempts.push(
      attempt(content, 1, newRun, false, 12),
      attempt(content, 1, newRun, true, 13),
    );
    expect(skillStats('mathematics', [content], progress)).toEqual({
      mastery: 50,
      accuracy: 50,
      assessed: 2,
      total: 2,
    });
    progress.attempts.reverse();
    expect(skillStats('mathematics', [content], progress)).toEqual({
      mastery: 50,
      accuracy: 50,
      assessed: 2,
      total: 2,
    });
  });

  it('lets a new unsuccessful review lower mastery instead of preserving a historical best guess', () => {
    const content = lesson('review-mastery', 'm1', 1);
    const progress = emptyProgress();
    progress.attempts = [attempt(content, 0, crypto.randomUUID(), true, 1)];
    const reviewRun = crypto.randomUUID();
    progress.attempts.push(
      attempt(content, 0, reviewRun, false, 10),
      attempt(content, 0, reviewRun, true, 11),
    );
    expect(skillStats('mathematics', [content], progress)).toMatchObject({
      mastery: 0,
      accuracy: 0,
      assessed: 1,
    });
  });

  it('weights each exam exercise twice, includes unassessed coverage in mastery and limits scoring to the requested skill', () => {
    const content = lesson('regular', 'm1', 2);
    const exam = lesson('weighted-exam', 'm1', 1, true);
    const unrelated = lesson('english', 'm1', 1, false, ['english']);
    const progress = emptyProgress();
    const runId = crypto.randomUUID();
    progress.attempts = [
      attempt(content, 0, runId, true),
      attempt(content, 1, runId, false),
      attempt(unrelated, 0, runId, true),
    ];
    expect(skillStats('mathematics', [content, exam, unrelated], progress)).toEqual({
      mastery: 25,
      accuracy: 50,
      assessed: 2,
      total: 4,
    });
    progress.attempts.push(attempt(exam, 0, runId, true));
    expect(skillStats('mathematics', [content, exam, unrelated], progress)).toEqual({
      mastery: 75,
      accuracy: 75,
      assessed: 4,
      total: 4,
    });
    expect(skillStats('english', [content, exam, unrelated], progress)).toEqual({
      mastery: 100,
      accuracy: 100,
      assessed: 1,
      total: 1,
    });
    expect(skillStats('portfolio', [content, exam], progress)).toEqual({
      mastery: 0,
      accuracy: 0,
      assessed: 0,
      total: 0,
    });
  });

  it('identifies first attempts chronologically across ISO timezone offsets', () => {
    const content = lesson('offset-attempts', 'm1', 1);
    const progress = progressWithState(content);
    const runId = progress.states[content.id].runId;
    progress.attempts = [
      { ...attempt(content, 0, runId, true), at: '2026-01-01T08:00:00Z' },
      { ...attempt(content, 0, runId, false), at: '2026-01-01T12:00:00+05:00' },
    ];
    expect(runScore(content, progress, runId)).toBe(0);
    expect(skillStats('mathematics', [content], progress)).toEqual({
      mastery: 0,
      accuracy: 0,
      assessed: 1,
      total: 1,
    });
    expect(reviewLessons([content], progress).map((item) => item.id)).toEqual([content.id]);
  });
});

describe('review queue and learning continuation', () => {
  it('keeps a corrected exercise in review until a new run demonstrates a correct first answer', () => {
    const content = lesson('review', 'm1', 1);
    const untouched = lesson('untouched', 'm2', 1);
    const progress = emptyProgress();
    const runId = crypto.randomUUID();
    progress.attempts = [attempt(content, 0, runId, false, 0), attempt(content, 0, runId, true, 1)];
    expect(reviewLessons([content, untouched], progress).map((item) => item.id)).toEqual([
      content.id,
    ]);
    progress.attempts.push(attempt(content, 0, crypto.randomUUID(), true, 10));
    expect(reviewLessons([content, untouched], progress)).toEqual([]);
  });

  it('scopes review evidence to its lesson when exercise ids overlap', () => {
    const first = lesson('first', 'm1', 1);
    const second = lesson('second', 'm2', 1);
    const firstExercise = exercisesOf(first)[0];
    second.blocks = second.blocks.map((block) =>
      block.type === 'exercise'
        ? { ...block, exercise: { ...block.exercise, id: firstExercise.id } }
        : block,
    );
    const progress = emptyProgress();
    progress.attempts = [
      attempt(first, 0, crypto.randomUUID(), false, 1),
      attempt(second, 0, crypto.randomUUID(), true, 2),
    ];
    expect(reviewLessons([first, second], progress).map((item) => item.id)).toEqual([first.id]);
  });

  it('continues the most recently active unlocked unfinished lesson ahead of the diagnostic recommendation', () => {
    const first = lesson('first', 'm1');
    const second = lesson('second', 'm2');
    const third = lesson('third', 'm3');
    const locked = lesson('locked', 'm1');
    const lessons = [first, locked, second, third];
    const progress = emptyProgress();
    progress.preferences.recommendedLesson = third.id;
    progress.states = {
      [first.id]: state(undefined, 10),
      [second.id]: state(undefined, 20),
      [locked.id]: state(undefined, 30),
    };
    expect(nextLesson(lessons, progress).id).toBe(second.id);
    progress.completions.push(completion(second));
    expect(nextLesson(lessons, progress).id).toBe(first.id);
  });

  it('falls back from an unavailable recommendation to the first available lesson and supports all-complete review', () => {
    const first = lesson('first');
    const second = lesson('second');
    const lessons = [first, second];
    const progress = emptyProgress();
    progress.preferences.recommendedLesson = second.id;
    expect(nextLesson(lessons, progress).id).toBe(first.id);
    progress.completions.push(completion(first));
    expect(nextLesson(lessons, progress).id).toBe(second.id);
    progress.completions.push(completion(second));
    expect(nextLesson(lessons, progress).id).toBe(first.id);
  });

  it('selects the latest active lesson using actual instants across timezone offsets', () => {
    const first = lesson('offset-first', 'm1');
    const second = lesson('offset-second', 'm2');
    const progress = emptyProgress();
    progress.states[first.id] = { ...state(), updatedAt: '2026-01-01T12:00:00+05:00' };
    progress.states[second.id] = { ...state(), updatedAt: '2026-01-01T08:00:00Z' };
    expect(nextLesson([first, second], progress).id).toBe(second.id);
  });
});
