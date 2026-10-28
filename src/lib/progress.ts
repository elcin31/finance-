import type { Answer, Lesson, SkillId } from './types';

export type Preferences = {
  goal: string;
  level: string;
  pace: number;
  diagnosticScore: number;
  recommendedLesson: string;
  onboardingDone: boolean;
};
export type Attempt = {
  id: string;
  lessonId: string;
  exerciseId: string;
  runId: string;
  contentVersion?: number;
  answer: Answer;
  correct: boolean;
  at: string;
};
export type LessonState = {
  position: number;
  runId: string;
  contentVersion?: number;
  drafts: Record<string, Answer>;
  updatedAt: string;
};
export type Completion = {
  lessonId: string;
  runId: string;
  version: number;
  score: number;
  completedAt: string;
};
export type Progress = {
  schemaVersion: 1;
  sourceId: string;
  preferences: Preferences;
  preferencesUpdatedAt: string;
  states: Record<string, LessonState>;
  attempts: Attempt[];
  completions: Completion[];
};
export const defaultPreferences: Preferences = {
  goal: 'Освоить финансовую грамотность',
  level: 'С нуля',
  pace: 15,
  diagnosticScore: 0,
  recommendedLesson: 'm1-money',
  onboardingDone: false,
};
export function emptyProgress(): Progress {
  return {
    schemaVersion: 1,
    sourceId: crypto.randomUUID(),
    preferences: { ...defaultPreferences },
    preferencesUpdatedAt: new Date(0).toISOString(),
    states: {},
    attempts: [],
    completions: [],
  };
}
export const exercisesOf = (lesson: Lesson) =>
  lesson.blocks.flatMap((b) => (b.type === 'exercise' ? [b.exercise] : []));
export function hasCompleted(progress: Progress, lesson: Lesson): boolean {
  return progress.completions.some(
    (c) =>
      c.lessonId === lesson.id && c.version === lesson.version && (!lesson.exam || c.score >= 70),
  );
}
export function isUnlocked(lesson: Lesson, lessons: Lesson[], progress: Progress): boolean {
  if (hasCompleted(progress, lesson)) return true;
  const peers = lessons.filter((l) => l.moduleId === lesson.moduleId);
  if (lesson.exam) return peers.filter((l) => !l.exam).every((l) => hasCompleted(progress, l));
  // The first lesson of each module is public. Foundations may always be revisited.
  const previous = peers
    .slice(
      0,
      peers.findIndex((l) => l.id === lesson.id),
    )
    .filter((l) => !l.exam);
  return previous.every((l) => hasCompleted(progress, l));
}
export function nextLesson(lessons: Lesson[], progress: Progress): Lesson {
  const active = lessons
    .filter(
      (l) =>
        progress.states[l.id] && !hasCompleted(progress, l) && isUnlocked(l, lessons, progress),
    )
    .sort(
      (a, b) =>
        Date.parse(progress.states[b.id].updatedAt) - Date.parse(progress.states[a.id].updatedAt),
    )[0];
  if (active) return active;
  const recommended = lessons.find(
    (l) =>
      l.id === progress.preferences.recommendedLesson &&
      !hasCompleted(progress, l) &&
      isUnlocked(l, lessons, progress),
  );
  return (
    recommended ??
    lessons.find((l) => !hasCompleted(progress, l) && isUnlocked(l, lessons, progress)) ??
    lessons[0]
  );
}
export function runScore(lesson: Lesson, progress: Progress, runId: string): number {
  const exercises = exercisesOf(lesson);
  const first = exercises.map(
    (e) =>
      progress.attempts
        .filter(
          (a) =>
            a.lessonId === lesson.id &&
            a.exerciseId === e.id &&
            (a.contentVersion ?? 1) === lesson.version &&
            a.runId === runId,
        )
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))[0],
  );
  return exercises.length
    ? Math.round((100 * first.filter((a) => a?.correct).length) / exercises.length)
    : 0;
}
export function canFinish(lesson: Lesson, progress: Progress, runId: string): boolean {
  const state = progress.states[lesson.id];
  if (state && ((state.contentVersion ?? 1) !== lesson.version || state.runId !== runId))
    return false;
  return exercisesOf(lesson).every((e) =>
    progress.attempts.some(
      (a) =>
        a.lessonId === lesson.id &&
        a.exerciseId === e.id &&
        (a.contentVersion ?? 1) === lesson.version &&
        a.runId === runId &&
        a.correct,
    ),
  );
}
export function finishLesson(lesson: Lesson, progress: Progress): Progress {
  const state = progress.states[lesson.id];
  if (
    !state ||
    !canFinish(lesson, progress, state.runId) ||
    progress.completions.some((c) => c.runId === state.runId)
  )
    return progress;
  return {
    ...progress,
    completions: [
      ...progress.completions,
      {
        lessonId: lesson.id,
        runId: state.runId,
        version: lesson.version,
        score: runScore(lesson, progress, state.runId),
        completedAt: new Date().toISOString(),
      },
    ],
  };
}
export function mergeProgress(server: Progress, incoming: Progress): Progress {
  const attempts = new Map(server.attempts.map((a) => [a.id, a]));
  incoming.attempts.forEach((a) => {
    if (!attempts.has(a.id)) attempts.set(a.id, a);
  });
  const completions = new Map(server.completions.map((c) => [c.runId, c]));
  incoming.completions.forEach((c) => {
    if (!completions.has(c.runId)) completions.set(c.runId, c);
  });
  const states = { ...server.states };
  Object.entries(incoming.states).forEach(([id, state]) => {
    if (!states[id] || Date.parse(state.updatedAt) > Date.parse(states[id].updatedAt))
      states[id] = state;
  });
  const preferIncoming =
    Date.parse(incoming.preferencesUpdatedAt) > Date.parse(server.preferencesUpdatedAt);
  return {
    ...server,
    preferences: preferIncoming ? incoming.preferences : server.preferences,
    preferencesUpdatedAt: preferIncoming
      ? incoming.preferencesUpdatedAt
      : server.preferencesUpdatedAt,
    states,
    attempts: [...attempts.values()],
    completions: [...completions.values()],
  };
}
export function skillStats(skill: SkillId, lessons: Lesson[], progress: Progress) {
  const items = lessons.flatMap((l) =>
    exercisesOf(l)
      .filter((e) => e.skills.includes(skill))
      .map((e) => ({ lesson: l, exercise: e, weight: l.exam ? 2 : 1 })),
  );
  let assessed = 0,
    correct = 0;
  for (const { lesson, exercise, weight } of items) {
    if ((progress.states[lesson.id]?.contentVersion ?? 1) !== lesson.version) continue;
    const all = progress.attempts
      .filter(
        (a) =>
          a.lessonId === lesson.id &&
          a.exerciseId === exercise.id &&
          (a.contentVersion ?? 1) === lesson.version,
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
    const latest = all.at(-1);
    if (!latest) continue;
    const first = all.find((a) => a.runId === latest.runId)!;
    assessed += weight;
    if (first.correct) correct += weight;
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return {
    mastery: total ? Math.round((correct / total) * 100) : 0,
    accuracy: assessed ? Math.round((correct / assessed) * 100) : 0,
    assessed,
    total,
  };
}
export function reviewLessons(lessons: Lesson[], progress: Progress) {
  return lessons.filter((lesson) =>
    exercisesOf(lesson).some((e) => {
      const a = progress.attempts
        .filter(
          (x) =>
            x.lessonId === lesson.id &&
            x.exerciseId === e.id &&
            (x.contentVersion ?? 1) === lesson.version,
        )
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
      const last = a.at(-1);
      return last && !a.find((x) => x.runId === last.runId)?.correct;
    }),
  );
}
