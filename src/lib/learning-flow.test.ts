import { describe, expect, it } from 'vitest';
import { emptyProgress, hasCompleted, nextLesson } from './progress';
import { emptyLearningData, mergeLearningData } from './learning-store';
import { generateProblem } from './problem-generator';
import { freshGeneratedProblem } from './practice-registry';
import { buildKnowledge, deriveReviewSchedule, addUtcDays } from './knowledge';
import { withExamResults } from './effective-progress';
import { examInputError } from './exam-input';
import { buildExamBank, sanitizeExamQuestion } from './exam-bank';
import { lessons } from '@/content/curriculum';
import type { LearningEvent, ExamResult } from './learning-types';

const date = '2026-01-01T12:00:00.000Z';
function event(changes: Partial<LearningEvent> = {}): LearningEvent {
  const entry = generateProblem('present-value', 10, 1);
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    exerciseId: entry.exercise.id,
    templateId: entry.exercise.templateId!,
    variantId: entry.exercise.variantId!,
    seed: 10,
    lessonId: entry.lessonId,
    contentVersion: 2,
    competencyIds: entry.competencyIds,
    difficulty: 1,
    mode: 'practice',
    answer: '0',
    valid: true,
    correct: false,
    errorType: 'calculation',
    hintsUsed: false,
    at: date,
    ...changes,
  };
}

describe('replayable learning flow across data boundaries', () => {
  it('keeps a mistake, correction, due queue and fresh delayed success through idempotent sync and JSON reload', () => {
    const first = event(),
      correction = event({ at: '2026-01-01T12:01:00.000Z', correct: true, errorType: 'none' });
    const guest = { ...emptyLearningData(), events: [first, correction] };
    const canonical = mergeLearningData(emptyLearningData(), guest);
    expect(mergeLearningData(canonical, guest)).toEqual(canonical);
    const reload = JSON.parse(JSON.stringify(canonical));
    const entries = [generateProblem('present-value', 0, 1)];
    const before = buildKnowledge(emptyProgress(), reload, entries, '2026-01-03T12:00:00Z');
    expect(before.reviewQueue.some((item) => item.competencyId === 'present-value')).toBe(true);
    expect(before.skills.find((item) => item.id === 'present-value')?.firstAttemptAccuracy).toBe(0);
    const next = freshGeneratedProblem('present-value', canonical, 1);
    const review = event({
      exerciseId: next.exercise.id,
      variantId: next.exercise.variantId!,
      seed: next.exercise.seed!,
      mode: 'review',
      at: '2026-01-03T12:01:00Z',
      correct: true,
      errorType: 'none',
    });
    const after = buildKnowledge(
      emptyProgress(),
      { ...reload, events: [...reload.events, review] },
      entries,
      '2026-01-03T12:02:00Z',
    );
    expect(after.skills.find((item) => item.id === 'present-value')?.reviewScore).toBe(25);
    expect(after.skills.find((item) => item.id === 'present-value')!.mastery).toBeGreaterThan(
      before.skills.find((item) => item.id === 'present-value')!.mastery,
    );
    expect(after.reviewQueue.some((item) => item.competencyId === 'present-value')).toBe(false);
  });
  it('allows a fixed-bank question to test retention after a seven-day gap, with no points for daily resubmission', () => {
    const initial = event({
      correct: true,
      errorType: 'none',
      source: 'learning',
    } as Partial<LearningEvent>);
    const evidence = { ...initial, source: 'learning' as const };
    const daily = Array.from({ length: 30 }, (_, index) => ({
      ...evidence,
      id: `day-${index}`,
      sessionId: `session-${index}`,
      mode: 'review' as const,
      at: addUtcDays(date, index + 1),
    }));
    expect(deriveReviewSchedule([evidence, ...daily], addUtcDays(date, 31)).stage).toBe(0);
    const delayed = {
      ...evidence,
      id: 'after-week',
      mode: 'review' as const,
      at: addUtcDays(date, 7),
    };
    expect(deriveReviewSchedule([evidence, delayed], addUtcDays(date, 8)).stage).toBe(1);
    const resend = { ...delayed, id: 'same-day-resend', at: addUtcDays(date, 7) };
    expect(deriveReviewSchedule([evidence, delayed, resend], addUtcDays(date, 8)).stage).toBe(1);
  });
  it('adds server-passed exams to a view without changing historical progress or accepting a score below 80', () => {
    const progress = emptyProgress();
    const lesson = lessons.find((item) => item.id === 'm1-exam')!;
    const result: ExamResult = {
      id: crypto.randomUUID(),
      moduleId: 'm1',
      lessonId: lesson.id,
      bankVersion: 2,
      variant: 0,
      score: 87.5,
      passed: true,
      submittedAt: date,
      answers: [],
    };
    const effective = withExamResults(progress, [result, result]);
    expect(hasCompleted(effective, lesson)).toBe(true);
    expect(progress.completions).toEqual([]);
    expect(withExamResults(progress, [{ ...result, score: 79.99 }]).completions).toEqual([]);
    expect(nextLesson(lessons, effective).exam).toBeFalsy();
  });
  it('validates public exam inputs without exposing or calculating a grading result', () => {
    const bank = buildExamBank()[0];
    for (const privateQuestion of bank.questions) {
      const question = sanitizeExamQuestion(privateQuestion);
      expect(Object.hasOwn(question.exercise, 'correct')).toBe(false);
      expect(Object.hasOwn(question.exercise, 'expected')).toBe(false);
      if (question.exercise.kind === 'numeric') {
        expect(examInputError(question, 'NaN')).toBeTruthy();
        expect(examInputError(question, '∞')).toBeTruthy();
        expect(examInputError(question, '7,5')).toBeNull();
        if (question.exercise.unit === 'percent')
          expect(examInputError(question, '7,5 ₽')).toBeTruthy();
      }
    }
  });
});
