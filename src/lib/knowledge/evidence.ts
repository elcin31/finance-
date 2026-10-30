import { lessons } from '@/content/curriculum';
import { isCompetencyId } from '@/content/skills';
import { gradeExercise } from '../evaluation';
import type { ErrorType, ExerciseEntry, LearningData, LearningEvent } from '../learning-types';
import type { Progress } from '../progress';
import type { Exercise } from '../types';
import { difficultyForExercise, mapLegacyExercise } from './mapping';
import type { KnowledgeEvidence } from './types';

export type CatalogueEntry = ExerciseEntry & { legacy: boolean; exam: boolean };

export function exerciseCatalogue(entries: ExerciseEntry[]): CatalogueEntry[] {
  const catalogue = new Map<string, CatalogueEntry>();
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      if (block.type !== 'exercise') continue;
      catalogue.set(`${lesson.id}|${block.exercise.id}`, {
        exercise: block.exercise,
        lessonId: lesson.id,
        competencyIds: mapLegacyExercise(lesson.id, block.exercise),
        difficulty: difficultyForExercise(lesson.id, block.exercise),
        legacy: true,
        exam: Boolean(lesson.exam),
      });
    }
  }
  for (const entry of entries) {
    catalogue.set(`${entry.lessonId}|${entry.exercise.id}`, {
      ...entry,
      competencyIds: [...new Set(entry.competencyIds.filter(isCompetencyId))],
      legacy: false,
      exam: false,
    });
  }
  return [...catalogue.values()].sort(
    (a, b) => a.lessonId.localeCompare(b.lessonId) || a.exercise.id.localeCompare(b.exercise.id),
  );
}

function errorFor(
  exercise: Exercise,
  correct: boolean,
  valid: boolean,
  message: string,
): ErrorType {
  if (correct) return 'none';
  if (!valid) return /единиц|валют/u.test(message) ? 'unit' : 'format';
  if (exercise.kind === 'numeric' || exercise.kind === 'calculation') return 'calculation';
  if (exercise.kind === 'ordering') return 'ordering';
  if (exercise.kind === 'matching' || exercise.kind === 'choice') return 'selection';
  return 'concept';
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? '';
}

/** Stable tie-breaks also make a contradictory duplicate conservative, never an extra success. */
function compareDuplicate(a: LearningEvent, b: LearningEvent): number {
  return (
    Number(a.valid) - Number(b.valid) ||
    Number(a.correct) - Number(b.correct) ||
    Number(b.hintsUsed) - Number(a.hintsUsed) ||
    Date.parse(a.at) - Date.parse(b.at) ||
    stableValue(a).localeCompare(stableValue(b))
  );
}

export function collectEvidence(
  progress: Progress,
  learning: LearningData,
  entries: ExerciseEntry[] = [],
): KnowledgeEvidence[] {
  const catalogue = exerciseCatalogue(entries);
  const byExercise = new Map(
    catalogue.map((entry) => [`${entry.lessonId}|${entry.exercise.id}`, entry]),
  );
  const byLesson = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const combined = new Map<string, KnowledgeEvidence>();
  const learningIds = new Set(learning.events.map((event) => event.id));

  for (const attempt of progress.attempts) {
    // A richer event written with the same client ID owns the record, including invalid answers.
    if (learningIds.has(attempt.id)) continue;
    const lesson = byLesson.get(attempt.lessonId);
    const entry = byExercise.get(`${attempt.lessonId}|${attempt.exerciseId}`);
    if (
      !lesson ||
      !entry ||
      (attempt.contentVersion ?? 1) !== lesson.version ||
      !Number.isFinite(Date.parse(attempt.at))
    )
      continue;
    const grade = gradeExercise(entry.exercise, attempt.answer);
    const evidence: KnowledgeEvidence = {
      id: attempt.id,
      sessionId: attempt.runId,
      exerciseId: attempt.exerciseId,
      templateId: entry.exercise.templateId ?? attempt.exerciseId,
      variantId: entry.exercise.variantId ?? attempt.exerciseId,
      seed: entry.exercise.seed ?? 0,
      lessonId: attempt.lessonId,
      contentVersion: lesson.version,
      competencyIds: entry.competencyIds,
      difficulty: entry.difficulty,
      mode: 'lesson',
      answer: attempt.answer,
      valid: grade.valid,
      correct: grade.correct,
      errorType: errorFor(entry.exercise, grade.correct, grade.valid, grade.message),
      hintsUsed: false,
      at: new Date(attempt.at).toISOString(),
      source: 'legacy',
    };
    const previous = combined.get(evidence.id);
    if (!previous || compareDuplicate(evidence, previous) < 0) combined.set(evidence.id, evidence);
  }

  const rich = new Map<string, LearningEvent>();
  for (const event of learning.events) {
    const lesson = byLesson.get(event.lessonId);
    const entry = byExercise.get(`${event.lessonId}|${event.exerciseId}`);
    if (!Number.isFinite(Date.parse(event.at))) continue;
    if (event.mode === 'lesson') {
      if (!lesson || event.contentVersion !== lesson.version || !entry) continue;
    } else if (event.contentVersion !== 2) continue;
    const competencyIds = entry?.competencyIds.length
      ? entry.competencyIds
      : [...new Set(event.competencyIds.filter(isCompetencyId))];
    if (!competencyIds.length) continue;
    const normalized: LearningEvent = {
      ...event,
      competencyIds,
      difficulty: entry?.difficulty ?? event.difficulty,
      at: new Date(event.at).toISOString(),
    };
    if (![1, 2, 3].includes(normalized.difficulty)) continue;
    const previous = rich.get(event.id);
    if (!previous || compareDuplicate(normalized, previous) < 0) rich.set(event.id, normalized);
  }
  for (const event of rich.values()) combined.set(event.id, { ...event, source: 'learning' });
  return [...combined.values()].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id),
  );
}
