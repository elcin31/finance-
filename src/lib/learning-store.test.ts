import { describe, expect, it, vi } from 'vitest';
import {
  emptyLearningData,
  initialExerciseAnswer,
  mergeLearningData,
  stableSeed,
} from './learning-store';
import {
  allPracticeEntries,
  freshGeneratedProblem,
  restoreExercise,
  selectPractice,
} from './practice-registry';
import { generateProblem, problemTemplates } from './problem-generator';
import type {
  ExamResult,
  ExerciseEntry,
  LearningData,
  LearningEvent,
  PracticeDraft,
} from './learning-types';
import type { CalculationExercise, Exercise, OrderingExercise } from './types';

const baseEvent: LearningEvent = {
  id: '10000000-0000-4000-8000-000000000001',
  sessionId: '20000000-0000-4000-8000-000000000001',
  exerciseId: 'generated:future-value:1:1',
  templateId: 'future-value',
  variantId: 'bank-v1:future-value:1:1',
  seed: 1,
  lessonId: 'm2-fv',
  contentVersion: 2,
  competencyIds: ['future-value', 'compounding'],
  difficulty: 1,
  mode: 'practice',
  answer: '1210',
  valid: true,
  correct: false,
  errorType: 'calculation',
  hintsUsed: false,
  at: '2026-10-29T07:00:00Z',
};

const baseDraft: PracticeDraft = {
  id: 'practice-fv',
  sessionId: '20000000-0000-4000-8000-000000000001',
  exerciseId: 'generated:future-value:1:1',
  templateId: 'future-value',
  seed: 1,
  mode: 'practice',
  answer: 'draft answer',
  updatedAt: '2026-10-29T07:00:00Z',
};

const baseExam: ExamResult = {
  id: '30000000-0000-4000-8000-000000000001',
  moduleId: 'm2',
  lessonId: 'm2-exam',
  bankVersion: 2,
  variant: 0,
  score: 0,
  passed: false,
  submittedAt: '2026-10-29T07:00:00Z',
  answers: [
    {
      questionId: 'q1',
      competencyIds: ['future-value'],
      difficulty: 1,
      answer: '0',
      correct: false,
      explanation: 'Discount the cash flow.',
      expectedAnswer: '1210',
    },
  ],
};

function eventFor(
  entry: ExerciseEntry,
  index: number,
  at: string,
  changes: Partial<LearningEvent> = {},
): LearningEvent {
  return {
    ...baseEvent,
    id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    exerciseId: entry.exercise.id,
    templateId: entry.exercise.templateId ?? entry.exercise.id,
    variantId: entry.exercise.variantId ?? `${entry.exercise.id}:v1`,
    seed: entry.exercise.seed ?? 0,
    competencyIds: entry.competencyIds,
    lessonId: entry.lessonId,
    difficulty: entry.difficulty,
    at,
    ...changes,
  };
}

describe('learning data merge', () => {
  it('starts from a fresh version-2 document without shared mutable containers', () => {
    const first = emptyLearningData(),
      second = emptyLearningData();
    expect(first).toEqual({ version: 2, events: [], drafts: {}, examResults: [] });
    expect(first.events).not.toBe(second.events);
    expect(first.drafts).not.toBe(second.drafts);
    expect(first.examResults).not.toBe(second.examResults);
  });

  it('preserves acknowledged immutable event IDs and merges each new event exactly once', () => {
    const acknowledged = { ...baseEvent, correct: false, answer: 'wrong answer' };
    const forgedReplacement = {
      ...baseEvent,
      correct: true,
      answer: 'correct answer',
      errorType: 'none' as const,
    };
    const newEvent = { ...baseEvent, id: '10000000-0000-4000-8000-000000000002' };
    const server: LearningData = { ...emptyLearningData(), events: [acknowledged] };
    const local: LearningData = { ...emptyLearningData(), events: [forgedReplacement, newEvent] };
    const beforeServer = structuredClone(server),
      beforeLocal = structuredClone(local);
    const merged = mergeLearningData(server, local);
    expect(merged.events).toEqual([acknowledged, newEvent]);
    expect(merged.events.find((event) => event.id === baseEvent.id)?.correct).toBe(false);
    expect(mergeLearningData(merged, local)).toEqual(merged);
    expect(server).toEqual(beforeServer);
    expect(local).toEqual(beforeLocal);
  });

  it('chooses draft updates by actual ISO instants rather than their string order', () => {
    const newerLocal: PracticeDraft = {
      ...baseDraft,
      answer: 'new local',
      updatedAt: '2026-10-29T07:00:00Z',
    };
    const olderServer: PracticeDraft = {
      ...baseDraft,
      answer: 'old server',
      updatedAt: '2026-10-29T09:00:00+03:00',
    };
    expect(
      mergeLearningData(
        { ...emptyLearningData(), drafts: { [baseDraft.id]: olderServer } },
        { ...emptyLearningData(), drafts: { [baseDraft.id]: newerLocal } },
      ).drafts[baseDraft.id],
    ).toEqual(newerLocal);
    const newerServer: PracticeDraft = {
      ...baseDraft,
      answer: 'new server',
      updatedAt: '2026-10-29T07:00:00Z',
    };
    const olderLocal: PracticeDraft = {
      ...baseDraft,
      answer: 'old local',
      updatedAt: '2026-10-29T09:00:00+03:00',
    };
    expect(
      mergeLearningData(
        { ...emptyLearningData(), drafts: { [baseDraft.id]: newerServer } },
        { ...emptyLearningData(), drafts: { [baseDraft.id]: olderLocal } },
      ).drafts[baseDraft.id],
    ).toEqual(newerServer);
  });

  it('keeps server state on equal timestamps and retains unrelated draft IDs', () => {
    const server: LearningData = { ...emptyLearningData(), drafts: { [baseDraft.id]: baseDraft } };
    const sameInstant = {
      ...baseDraft,
      answer: 'overwrite',
      updatedAt: '2026-10-29T10:00:00+03:00',
    };
    const newDraft = { ...baseDraft, id: 'english-reading', answer: 'another context' };
    const merged = mergeLearningData(server, {
      ...emptyLearningData(),
      drafts: { [baseDraft.id]: sameInstant, [newDraft.id]: newDraft },
    });
    expect(merged.drafts[baseDraft.id]).toEqual(baseDraft);
    expect(merged.drafts[newDraft.id]).toEqual(newDraft);
    expect(server.drafts).toEqual({ [baseDraft.id]: baseDraft });
  });

  it('never accepts a locally injected or changed exam result as an authoritative result', () => {
    const clientForged = { ...baseExam, score: 100, passed: true };
    expect(
      mergeLearningData(emptyLearningData(), {
        ...emptyLearningData(),
        examResults: [clientForged],
      }).examResults,
    ).toEqual([]);
    const authoritative: LearningData = { ...emptyLearningData(), examResults: [baseExam] };
    expect(
      mergeLearningData(authoritative, { ...emptyLearningData(), examResults: [clientForged] })
        .examResults,
    ).toEqual([baseExam]);
    expect(mergeLearningData(authoritative, emptyLearningData()).examResults).toEqual([baseExam]);
  });
});

describe('initial answers across old and new exercise kinds', () => {
  const base = {
    id: 'fixture',
    prompt: 'Prompt',
    hint: 'Hint',
    explanation: 'Explanation',
    skills: ['mathematics' as const],
  };
  it('preserves the legacy scalar, choice and matching input shapes', () => {
    expect(initialExerciseAnswer({ kind: 'numeric' })).toBe('');
    expect(initialExerciseAnswer({ kind: 'boolean' })).toBe('');
    expect(initialExerciseAnswer({ kind: 'choice' })).toEqual([]);
    expect(initialExerciseAnswer({ kind: 'scenario' })).toEqual([]);
    expect(initialExerciseAnswer({ kind: 'matching' })).toEqual({});
  });

  it('starts ordering as an independent complete permutation without leaking correctOrder', () => {
    const ordering: OrderingExercise = {
      ...base,
      kind: 'ordering',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      correctOrder: ['c', 'a', 'b'],
    };
    const original = structuredClone(ordering);
    expect(initialExerciseAnswer(ordering)).toEqual(['b', 'c', 'a']);
    expect(initialExerciseAnswer({ kind: 'ordering', items: ordering.items })).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(ordering).toEqual(original);
  });

  it('hydrates calculation parameter defaults while leaving the result unanswered', () => {
    const calculation: CalculationExercise = {
      ...base,
      kind: 'calculation',
      model: 'future-value',
      unit: 'currency',
      parameters: [
        { id: 'initial', label: 'Сумма', value: 1000, min: 0, max: 10000, step: 100, unit: '₽' },
        { id: 'rate', label: 'Ставка', value: 7.5, min: 0, max: 20, step: 0.5, unit: '%' },
        { id: 'years', label: 'Годы', value: 2, min: 0, max: 10, step: 1, unit: 'лет' },
      ],
    };
    const answer = initialExerciseAnswer(calculation);
    expect(answer).toEqual({ initial: '1000', rate: '7.5', years: '2', result: '' });
    expect(initialExerciseAnswer(calculation)).not.toBe(answer);
    expect(
      initialExerciseAnswer({ kind: 'calculation', parameters: calculation.parameters }),
    ).toEqual(answer);
  });
});

describe('stable practice seeds', () => {
  it('uses reproducible unsigned FNV-1a seeds and preserves Unicode inputs', () => {
    expect(stableSeed('')).toBe(2166136261);
    expect(stableSeed('hello')).toBe(1335831723);
    for (const value of ['future-value:1', 'inflation:real-return:2', 'Проценты 📈', '']) {
      const seed = stableSeed(value);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
      for (let run = 0; run < 20; run += 1) expect(stableSeed(value)).toBe(seed);
    }
  });
  it('does not read the clock or Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('ambient random');
    });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('ambient time');
    });
    try {
      expect(stableSeed('fixed-context')).toBe(stableSeed('fixed-context'));
    } finally {
      random.mockRestore();
      clock.mockRestore();
    }
  });
});

describe('practice registry restoration and rotation', () => {
  it('restores every seeded variant at its encoded difficulty after a reload', () => {
    for (const template of problemTemplates) {
      for (const difficulty of [1, 2, 3] as const) {
        const generated = generateProblem(template.id, 1205783, difficulty);
        expect(restoreExercise(template.id, generated.exercise.id, 1205783)).toEqual(generated);
      }
    }
    const authored = allPracticeEntries.find(
      (entry) => !problemTemplates.some((template) => template.id === entry.exercise.templateId),
    )!;
    expect(
      restoreExercise(
        authored.exercise.templateId ?? authored.exercise.id,
        authored.exercise.id,
        0,
      ),
    ).toEqual(authored);
    expect(restoreExercise('not-a-template', 'not-an-exercise', 0)).toBeUndefined();
  });

  it('respects an explicit generated difficulty when upgrading an old draft id', () => {
    expect(restoreExercise('future-value', 'legacy-fv-id', 42, 3)).toEqual(
      generateProblem('future-value', 42, 3),
    );
  });

  it('gives a new variant of the same family after a valid incorrect attempt', () => {
    for (const template of problemTemplates) {
      const first = freshGeneratedProblem(template.id, emptyLearningData(), 2);
      const data = { ...emptyLearningData(), events: [eventFor(first, 1, '2026-10-29T07:00:00Z')] };
      const second = freshGeneratedProblem(template.id, data, 2);
      expect(second.exercise.templateId).toBe(first.exercise.templateId);
      expect(second.exercise.variantId, template.id).not.toBe(first.exercise.variantId);
      expect(second.exercise.prompt, template.id).not.toBe(first.exercise.prompt);
    }
  });

  it('selects an unseen applicable family before repeating the one just answered incorrectly', () => {
    const first = selectPractice(emptyLearningData(), 'returns', 2);
    const data = { ...emptyLearningData(), events: [eventFor(first, 1, '2026-10-29T07:00:00Z')] };
    const next = selectPractice(data, 'returns', 2);
    expect(next.competencyIds).toContain('returns');
    expect(next.exercise.templateId ?? next.exercise.id).not.toBe(
      first.exercise.templateId ?? first.exercise.id,
    );
  });

  it('keeps financial English category selection within the requested track', () => {
    const entry = selectPractice(emptyLearningData(), 'english-reading', 2, 'reading');
    expect(entry.category).toBe('reading');
    expect(entry.competencyIds).toContain('english-reading');
  });
});
