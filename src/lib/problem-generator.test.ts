import { describe, expect, it, vi } from 'vitest';
import { gradeExercise } from './evaluation';
import {
  generateProblem,
  getProblemInputs,
  problemTemplates,
  type ProblemInputs,
  type ProblemTemplateId,
} from './problem-generator';
import type { NumericExercise } from './types';

function scalar(inputs: ProblemInputs, key: string): number {
  const value = inputs[key];
  if (typeof value !== 'number') throw new Error(`Missing scalar ${key}`);
  return value;
}

/** Independent textbook formulas, not calls to the implementation's finance helpers. */
function independentExpected(templateId: ProblemTemplateId, facts: ProblemInputs): number {
  const n = (key: string) => scalar(facts, key);
  const flows = facts.cashflows as readonly number[];
  switch (templateId) {
    case 'future-value':
      return n('initial') * Math.pow(1 + n('rate') / 100, n('years'));
    case 'present-value':
      return n('amount') / Math.pow(1 + n('rate') / 100, n('years'));
    case 'simple-compound':
      return (
        n('initial') *
        (Math.pow(1 + n('rate') / 100, n('years')) - 1 - (n('rate') / 100) * n('years'))
      );
    case 'discount-two-flows':
      return n('first') / (1 + n('rate') / 100) + n('second') / Math.pow(1 + n('rate') / 100, 2);
    case 'total-return':
      return ((n('sale') + n('distribution')) / n('purchase')) * 100 - 100;
    case 'net-return':
      return ((n('ending') - n('fee') - n('tax')) / n('initial')) * 100 - 100;
    case 'real-return':
      return ((n('nominal') - n('inflation')) / (100 + n('inflation'))) * 100;
    case 'cagr':
      return Math.expm1(Math.log(n('ending') / n('initial')) / n('years')) * 100;
    case 'portfolio-return':
      return (n('weightA') * n('returnA') + (100 - n('weightA')) * n('returnB')) / 100;
    case 'basis-points':
      return n('to') * 100 - n('from') * 100;
    case 'npv':
      return flows.reduce(
        (sum, flow, period) => sum + flow / Math.pow(1 + n('rate') / 100, period),
        0,
      );
    case 'irr': {
      const initial = -flows[0];
      if (flows.length === 3 && flows[1] > 0)
        return (
          ((flows[1] + Math.sqrt(flows[1] ** 2 + 4 * initial * flows[2])) / (2 * initial) - 1) * 100
        );
      return (Math.pow(flows[flows.length - 1] / initial, 1 / (flows.length - 1)) - 1) * 100;
    }
    case 'coupon-yield':
      return (n('annualCoupon') / n('price')) * 100;
    case 'drawdown':
      return (1 - n('trough') / n('peak')) * 100;
  }
}

describe('seeded financial problem bank', () => {
  it('contains fourteen distinct linked templates with competency metadata', () => {
    expect(problemTemplates).toHaveLength(14);
    expect(new Set(problemTemplates.map((template) => template.id)).size).toBe(14);
    for (const template of problemTemplates) {
      expect(template.lessonId).toMatch(/^m[123]-/);
      expect(template.competencyIds.length).toBeGreaterThan(0);
      expect(template.title.length).toBeGreaterThan(10);
    }
  });

  it.each(problemTemplates)(
    'reproduces $id across 100 seeds and all levels with independently verified mathematics',
    (template) => {
      for (const difficulty of [1, 2, 3] as const) {
        for (let seed = 0; seed < 100; seed += 1) {
          const context = `${template.id} / ${seed} / ${difficulty}`;
          const first = generateProblem(template.id, seed, difficulty);
          const second = generateProblem(template.id, seed, difficulty);
          const exercise = first.exercise as NumericExercise;
          expect(first, context).toEqual(second);
          expect(exercise.kind, context).toBe('numeric');
          expect(exercise.templateId, context).toBe(template.id);
          expect(exercise.seed, context).toBe(seed);
          expect(exercise.difficulty, context).toBe(difficulty);
          expect(exercise.variantId, context).toContain(`${template.id}:${seed}:${difficulty}`);
          expect(exercise.id, context).toContain(`${template.id}:${seed}:${difficulty}`);
          expect(first.competencyIds, context).toEqual(template.competencyIds);
          expect(exercise.competencyIds, context).toEqual(first.competencyIds);
          const expected = independentExpected(
            template.id,
            getProblemInputs(template.id, seed, difficulty),
          );
          expect(Number.isFinite(exercise.expected), context).toBe(true);
          expect(exercise.expected, context).toBeCloseTo(expected, 7);
          // A correctly rounded Russian answer is accepted, including negative rates.
          expect(
            gradeExercise(exercise, expected.toFixed(2).replace('.', ',')).correct,
            context,
          ).toBe(true);
          expect(gradeExercise(exercise, String(expected + 1)).correct, context).toBe(false);
          expect(exercise.prompt.length, context).toBeGreaterThan(100);
          expect(exercise.hint.length, context).toBeGreaterThan(70);
          expect(exercise.explanation, context).toContain('1.');
          expect(exercise.explanation, context).toContain('2.');
          expect(exercise.explanation, context).toContain('3.');
          expect(exercise.instruction, context).toContain('учебн');
        }
      }
    },
  );

  it('uses no ambient randomness or clock while generating variants', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('ambient random');
    });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('ambient clock');
    });
    try {
      for (const template of problemTemplates)
        expect(() => generateProblem(template.id, 1835000022, 3)).not.toThrow();
    } finally {
      random.mockRestore();
      clock.mockRestore();
    }
  });

  it('keeps independent seed streams and avoids repeated fixed-number questions', () => {
    for (const template of problemTemplates) {
      const variants = Array.from({ length: 100 }, (_, seed) =>
        generateProblem(template.id, seed, 2),
      );
      expect(new Set(variants.map((entry) => entry.exercise.id)).size).toBe(100);
      expect(
        new Set(variants.map((entry) => entry.exercise.prompt)).size,
        template.id,
      ).toBeGreaterThan(40);
      expect(generateProblem(template.id, 1, 1).exercise.variantId).not.toBe(
        generateProblem(template.id, 1, 2).exercise.variantId,
      );
    }
  });

  it('covers negative investment results and IRRs without NaN or ambiguous sign conventions', () => {
    for (const id of [
      'total-return',
      'net-return',
      'real-return',
      'cagr',
      'portfolio-return',
      'irr',
    ] as const) {
      const results = Array.from(
        { length: 100 },
        (_, seed) => (generateProblem(id, seed, 2).exercise as NumericExercise).expected,
      );
      expect(
        results.some((value) => value < 0),
        id,
      ).toBe(true);
      expect(results.every(Number.isFinite), id).toBe(true);
    }
    for (let seed = 0; seed < 100; seed += 1) {
      const exercise = generateProblem('drawdown', seed, 3).exercise as NumericExercise;
      expect(exercise.expected).toBeGreaterThan(0);
      expect(exercise.prompt).toContain('положительным');
    }
  });

  it('rejects invalid seeds, levels and template ids instead of silently choosing defaults', () => {
    expect(() => generateProblem('unknown', 1)).toThrow(RangeError);
    for (const seed of [NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() => generateProblem('npv', seed)).toThrow(RangeError);
    for (const difficulty of [0, 4, NaN, Infinity])
      expect(() => generateProblem('npv', 1, difficulty as 1)).toThrow(RangeError);
    for (const seed of [-1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])
      expect(generateProblem('irr', seed, 3)).toEqual(generateProblem('irr', seed, 3));
    expect(generateProblem('npv', -0)).toEqual(generateProblem('npv', 0));
  });

  it('keeps percentages, bp and currencies separate for generated exercises', () => {
    const percent = generateProblem('real-return', 45, 2).exercise as NumericExercise;
    const bp = generateProblem('basis-points', 45, 2).exercise as NumericExercise;
    const rub = generateProblem('present-value', 45, 2).exercise as NumericExercise;
    expect(gradeExercise(percent, `${percent.expected.toFixed(2)}%`).correct).toBe(true);
    expect(gradeExercise(percent, `${percent.expected.toFixed(2)} ₽`).valid).toBe(false);
    expect(gradeExercise(bp, `${bp.expected.toFixed(2)} bp`).correct).toBe(true);
    expect(gradeExercise(bp, `${bp.expected.toFixed(2)}%`).valid).toBe(false);
    expect(gradeExercise(rub, `${rub.expected.toFixed(2)} ₽`).correct).toBe(true);
    expect(gradeExercise(rub, `${rub.expected.toFixed(2)} USD`).valid).toBe(false);
    for (const exercise of [percent, bp, rub]) {
      for (const invalid of ['', 'NaN', 'Infinity', '1/0', '1.2.3'])
        expect(gradeExercise(exercise, invalid).valid).toBe(false);
    }
  });
});
