import { describe, expect, it } from 'vitest';
import type { LearningEvent } from './learning-types';
import { parseExamSession, parseLearningData, parseLearningEvent } from './learning-validation';
import { buildExamBank } from './exam-bank';

function event(): LearningEvent {
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    exerciseId: 'q1',
    templateId: 'total-return',
    variantId: 'v2:10:2',
    seed: 10,
    lessonId: 'm3-total-return',
    contentVersion: 2,
    competencyIds: ['returns'],
    difficulty: 2,
    mode: 'practice',
    answer: '10%',
    valid: true,
    correct: true,
    errorType: 'none',
    hintsUsed: false,
    at: new Date().toISOString(),
  };
}
describe('learning v2 data boundary', () => {
  it('validates events, immutable IDs and optional draft session/hints', () => {
    const item = event();
    const id = crypto.randomUUID();
    const data = {
      version: 2,
      events: [item],
      drafts: {
        [id]: {
          id,
          sessionId: item.sessionId,
          hintsUsed: true,
          exerciseId: 'q1',
          templateId: 'total-return',
          seed: 10,
          mode: 'practice',
          answer: '1,5',
          updatedAt: item.at,
        },
      },
      examResults: [],
    };
    expect(parseLearningData(data)).toEqual(data);
    expect(parseLearningData({ ...data, events: [item, item] })).toBeNull();
    expect(parseLearningData({ ...data, drafts: { wrongKey: data.drafts[id] } })).toBeNull();
  });
  it('rejects unknown modes, competencies, non-finite seeds and incompatible versions', () => {
    const item = event();
    for (const partial of [
      { mode: 'exam' },
      { competencyIds: ['invented'] },
      { competencyIds: ['returns', 'returns'] },
      { seed: NaN },
      { seed: Infinity },
      { contentVersion: 0 },
      { id: 'notuuid' },
      { valid: false },
    ])
      expect(parseLearningEvent({ ...item, ...partial })).toBeNull();
    expect(parseLearningData({ version: 1, events: [], drafts: {}, examResults: [] })).toBeNull();
  });
  it('compares dates as instants and rejects future/old event timestamps', () => {
    const item = event();
    expect(parseLearningEvent({ ...item, at: '2001-01-01T03:00:00+03:00' })).not.toBeNull();
    expect(parseLearningEvent({ ...item, at: '1999-12-31T23:59:59Z' })).toBeNull();
    expect(
      parseLearningEvent({ ...item, at: new Date(Date.now() + 600000).toISOString() }),
    ).toBeNull();
    expect(parseLearningEvent({ ...item, at: 'tomorrow' })).toBeNull();
  });
  it('rejects corrupted answers and oversized payloads without throwing', () => {
    expect(parseLearningEvent({ ...event(), answer: 'x'.repeat(3001) })).toBeNull();
    expect(
      parseLearningData({ version: 2, events: [], drafts: {}, examResults: [], grade: 100 }),
    ).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(parseLearningData(circular)).toBeNull();
  });
  it('accepts public bank sessions and rejects grading-key leaks', () => {
    const bank = buildExamBank()[0];
    const session = {
      id: crypto.randomUUID(),
      moduleId: bank.moduleId,
      lessonId: 'm1-exam',
      bankVersion: 2,
      variant: 0,
      startedAt: new Date().toISOString(),
      questions: bank.publicQuestions,
      draft: {},
      position: 0,
      updatedAt: new Date().toISOString(),
    };
    expect(parseExamSession(session)).not.toBeNull();
    const leaked = structuredClone(session);
    Object.assign(leaked.questions[0].exercise, { expected: 1 });
    expect(parseExamSession(leaked)).toBeNull();
  });
});
