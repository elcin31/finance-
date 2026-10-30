import { describe, expect, it } from 'vitest';
import { buildExamBank, examExpectedAnswer } from './exam-bank';
import { gradeExercise } from './evaluation';

describe('private server exam bank', () => {
  const bank = buildExamBank();
  it('builds sixteen reproducible eight-question variants in each module', () => {
    expect(bank).toEqual(buildExamBank());
    expect(bank).toHaveLength(48);
    for (const moduleId of ['m1', 'm2', 'm3']) {
      const variants = bank.filter((item) => item.moduleId === moduleId);
      expect(new Set(variants.map((item) => JSON.stringify(item.questions))).size).toBe(16);
      for (const item of variants) {
        expect(item.questions).toHaveLength(8);
        expect(new Set(item.questions.map((q) => q.id)).size).toBe(8);
      }
    }
  });
  it('contains no grading keys or matching answer maps in public questions', () => {
    const forbidden = new Set(['correct', 'expected', 'correctOrder', 'hint', 'explanation']);
    const visit = (value: unknown): void => {
      if (value && typeof value === 'object')
        for (const [key, nested] of Object.entries(value)) {
          expect(forbidden.has(key)).toBe(false);
          visit(nested);
        }
    };
    bank.forEach((item) => {
      visit(item.publicQuestions);
      expect(item.publicQuestions.every((q) => q.exercise.kind !== 'matching')).toBe(true);
    });
  });
  it('all 384 private solutions pass deterministic local grading', () => {
    for (const item of bank)
      for (const question of item.questions) {
        const result = gradeExercise(question.exercise, examExpectedAnswer(question.exercise));
        expect(result.correct, question.id).toBe(true);
        if (question.exercise.kind === 'numeric')
          expect(question.exercise.absoluteTolerance).toBe(0.005);
      }
  });
  it('assesses every financial competency in the protected exam bank', () => {
    const covered = new Set<string>(
      bank.flatMap((item) => item.questions.flatMap((question) => question.competencyIds)),
    );
    for (const id of [
      'financial-literacy',
      'interest-rates',
      'inflation',
      'returns',
      'compounding',
      'present-value',
      'future-value',
      'discounting',
      'npv',
      'irr',
      'stocks',
      'bonds',
      'dividends',
      'portfolio-returns',
      'diversification',
      'risk-return',
    ])
      expect(covered.has(id), id).toBe(true);
  });
});
