import type { Answer, Exercise } from './types';
import type { LearningData } from './learning-types';

export function emptyLearningData(): LearningData {
  return { version: 2, events: [], drafts: {}, examResults: [] };
}

/** Immutable event IDs are acknowledged by the server; client grades never replace exam results. */
export function mergeLearningData(server: LearningData, local: LearningData): LearningData {
  const events = new Map(server.events.map((event) => [event.id, event]));
  for (const event of local.events) if (!events.has(event.id)) events.set(event.id, event);
  const drafts = { ...server.drafts };
  for (const [id, draft] of Object.entries(local.drafts)) {
    if (!drafts[id] || Date.parse(draft.updatedAt) > Date.parse(drafts[id].updatedAt))
      drafts[id] = draft;
  }
  return { version: 2, events: [...events.values()], drafts, examResults: server.examResults };
}

export function initialExerciseAnswer(
  exercise: Pick<Exercise, 'kind'> & Partial<Exercise>,
): Answer {
  if (exercise.kind === 'ordering' && 'items' in exercise && exercise.items) {
    const ids = exercise.items.map((item) => item.id);
    return [...ids.slice(1), ...ids.slice(0, 1)];
  }
  if (exercise.kind === 'calculation' && 'parameters' in exercise && exercise.parameters) {
    return Object.fromEntries([
      ...exercise.parameters.map((p) => [p.id, String(p.value)]),
      ['result', ''],
    ]);
  }
  if (exercise.kind === 'matching') return {};
  if (exercise.kind === 'choice' || exercise.kind === 'scenario') return [];
  return '';
}

export function stableSeed(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
