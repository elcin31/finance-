import { describe, expect, it } from 'vitest';
import { getCalculationExpected, gradeExercise } from '@/lib/evaluation';
import type { CalculationExercise, NumericExercise } from '@/lib/types';
import { getExercises, getLesson, lessons } from './curriculum';
import { englishPractice, englishTracks, professionalTerms } from './english-practice';
import { financePractice } from './finance-practice';
import { practiceEntries } from './practice-bank';

const authoredNumeric = practiceEntries
  .map((entry) => entry.exercise)
  .filter((exercise): exercise is NumericExercise => exercise.kind === 'numeric');
/** These use the problem statements directly, without importing production financial functions. */
const numericReferences: Record<string, number> = {
  'fin02-net-worth': 180_000 + 420_000 - 230_000,
  'fin02-simple-interest': ((48_000 * 7) / 100) * 3,
  'fin02-fisher-real': (109 / 106 - 1) * 100,
  'fin02-holding-return': ((1_260 - 1_200 + 30) / 1_200) * 100,
  'fin02-sequential-return': (1.4 * 0.75 - 1) * 100,
  'fin02-annual-compound': 80_000 * 1.06 ** 4,
  'fin02-monthly-capitalization': 100_000 * (1 + 0.12 / 12) ** 12,
  'fin02-pv-inheritance': 120_000 / 1.07 ** 3,
  'fin02-pv-price-limit': 150_000 / 1.08 ** 2,
  'fin02-monthly-annuity': Array.from({ length: 12 }, (_, month) => 5_000 * 1.01 ** month).reduce(
    (sum, contribution) => sum + contribution,
    0,
  ),
  'fin02-zero-rate-plan': 15_000 + 18 * 2_500,
  'fin02-three-flow-dcf': 25_000 / 1.08 + 30_000 / 1.08 ** 2 + 35_000 / 1.08 ** 3,
  'fin02-time-zero-flow': -500 + 9_000 / 1.05 + 11_000 / 1.05 ** 2,
  'fin02-negative-npv': -80_000 + 45_000 / 1.1 + 45_000 / 1.1 ** 2,
  'fin02-staged-npv': -100_000 - 20_000 / 1.1 + 150_000 / 1.1 ** 2,
  'fin02-one-period-irr': (92_000 / 80_000 - 1) * 100,
  'fin02-market-cap': 2_500_000 * 84,
  'fin02-basic-eps': 120_000_000 / 30_000_000,
  'fin02-quarter-coupon': (2_000 * 0.08) / 4,
  'fin02-current-yield': (70 / 950) * 100,
  'fin02-dividend-yield': (18 / 360) * 100,
  'fin02-three-asset-return': 0.5 * 10 + 0.3 * -4 + 0.2 * 2,
  'fin02-two-asset-volatility': Math.sqrt((0.5 * 0.2) ** 2 + (0.5 * 0.3) ** 2) * 100,
  'fin02-drawdown-recovery': (150_000 / 117_000 - 1) * 100,
  'fin02-sharpe-ratio': (12 - 3) / 15,
  'en02-c-eps': (45_000_000 - 5_000_000) / 10_000_000,
  'en02-c-market-cap': 3_200_000 * 25,
  'en02-c-total-return': ((54 - 50 + 1) / 50) * 100,
  'en02-c-net-return': ((1_070 + 20 - 1_000) / 1_000) * 100,
  'en02-c-weighted-average': 0.4 * 12 + 0.6 * 3,
  'en02-c-current-yield': (60 / 960) * 100,
  'en02-c-future-value': 5_000 * 1.08 ** 3,
  'en02-c-present-value': 1_210 / 1.1 ** 2,
  'en02-c-real-return': (108 / 103 - 1) * 100,
  'en02-c-sharpe': (12 - 2) / 20,
};

describe('FINLAB 0.2 authored practice bank', () => {
  it('adds sixty financial and forty English tasks without changing the original curriculum', () => {
    expect(financePractice.length).toBeGreaterThanOrEqual(60);
    expect(englishPractice.length).toBeGreaterThanOrEqual(40);
    expect(practiceEntries).toHaveLength(financePractice.length + englishPractice.length);
    expect(lessons.filter((lesson) => !lesson.exam)).toHaveLength(18);
    expect(lessons.filter((lesson) => lesson.exam)).toHaveLength(3);
    expect(lessons.flatMap(getExercises)).toHaveLength(112);
  });

  it('keeps IDs globally unique, versioned and connected to real lessons and competencies', () => {
    const oldIds = lessons.flatMap(getExercises).map((exercise) => exercise.id);
    const ids = practiceEntries.map((entry) => entry.exercise.id);
    expect(new Set([...oldIds, ...ids]).size).toBe(oldIds.length + ids.length);
    expect(new Set(practiceEntries.map((entry) => entry.exercise.prompt)).size).toBe(
      practiceEntries.length,
    );
    for (const entry of practiceEntries) {
      const exercise = entry.exercise;
      expect(exercise.id).toMatch(/^(?:fin02|en02)-/);
      expect(getLesson(entry.lessonId)).toBeDefined();
      expect(entry.competencyIds.length).toBeGreaterThan(0);
      expect(exercise.competencyIds).toEqual(entry.competencyIds);
      expect(exercise.difficulty).toBe(entry.difficulty);
      expect(exercise.templateId).toBe(exercise.id);
      expect(exercise.variantId).toBe(`${exercise.id}:v1`);
      expect(exercise.seed).toBe(0);
      expect(exercise.instruction?.trim()).toBeTruthy();
      expect(exercise.hint.trim()).not.toBe('');
      expect(exercise.explanation.trim()).not.toBe('');
      expect(exercise.hint).not.toBe(exercise.explanation);
      expect(exercise.skills.length).toBeGreaterThan(0);
    }
    expect(new Set(financePractice.map((entry) => entry.difficulty))).toEqual(new Set([1, 2, 3]));
    expect(new Set(financePractice.flatMap((entry) => entry.competencyIds)).size).toBe(16);
  });

  it('covers all eight requested answer formats, including genuine multiple selection', () => {
    const formats = new Set(
      financePractice.map(({ exercise }) =>
        exercise.kind === 'choice' && exercise.multiple ? 'multiple' : exercise.kind,
      ),
    );
    expect(formats).toEqual(
      new Set([
        'numeric',
        'choice',
        'multiple',
        'boolean',
        'matching',
        'ordering',
        'scenario',
        'calculation',
      ]),
    );
    for (const { exercise } of practiceEntries) {
      if (exercise.kind === 'choice' || exercise.kind === 'scenario') {
        const ids = exercise.options.map((option) => option.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(exercise.correct.length).toBeGreaterThan(0);
        for (const answer of exercise.correct) expect(ids).toContain(answer);
        if (exercise.multiple) expect(exercise.correct.length).toBeGreaterThan(1);
      } else if (exercise.kind === 'ordering') {
        expect(new Set(exercise.correctOrder)).toEqual(
          new Set(exercise.items.map((item) => item.id)),
        );
        expect(exercise.correctOrder).toHaveLength(exercise.items.length);
      } else if (exercise.kind === 'matching') {
        expect(new Set(exercise.pairs.map((pair) => pair.id)).size).toBe(exercise.pairs.length);
        expect(new Set(exercise.pairs.map((pair) => pair.right)).size).toBe(exercise.pairs.length);
      }
    }
  });

  it('provides ten tasks per English track with separate observable competencies', () => {
    const mapping = {
      vocabulary: 'english-terminology',
      reading: 'english-reading',
      calculations: 'english-calculations',
      expressions: 'english-expressions',
    };
    expect(new Set(englishTracks.map((track) => track.id))).toEqual(new Set(Object.keys(mapping)));
    for (const track of englishTracks) {
      const entries = englishPractice.filter((entry) => entry.category === track.id);
      expect(entries.length).toBeGreaterThanOrEqual(10);
      for (const entry of entries) expect(entry.competencyIds).toEqual([mapping[track.id]]);
    }
  });

  it('links professional reference terms to existing lessons and English exercises', () => {
    expect(professionalTerms.length).toBeGreaterThanOrEqual(9);
    expect(new Set(professionalTerms.map((term) => term.en.toLowerCase())).size).toBe(
      professionalTerms.length,
    );
    const required = [
      'Net Return',
      'Gross Return',
      'Weighted Average',
      'Discount Rate',
      'Cash Flow',
      'Portfolio Allocation',
      'EPS',
      'Market Capitalization',
      'Risk-adjusted Return',
    ];
    for (const term of required)
      expect(professionalTerms.some((entry) => entry.en === term)).toBe(true);
    for (const term of professionalTerms) {
      expect(getLesson(term.lessonId)).toBeDefined();
      const entry = englishPractice.find((entry) => entry.exercise.id === term.exerciseId);
      expect(entry).toBeDefined();
      expect(entry?.lessonId).toBe(term.lessonId);
      expect(term.definition.trim()).not.toBe('');
      expect(term.context.trim()).not.toBe('');
    }
  });

  it('has an independent mathematical reference for every new fixed numeric answer', () => {
    expect(new Set(authoredNumeric.map((exercise) => exercise.id))).toEqual(
      new Set(Object.keys(numericReferences)),
    );
  });

  it('keeps dollars, rubles, percentages and dimensionless ratios distinct', () => {
    for (const entry of practiceEntries) {
      const exercise = entry.exercise;
      if (exercise.kind !== 'numeric') continue;
      const answer = exercise.expected.toFixed(2);
      if (exercise.unit === 'currency') {
        const currency = entry.category ? 'USD' : 'RUB';
        expect(exercise.currency).toBe(currency);
        expect(gradeExercise(exercise, `${answer} ${currency}`).correct).toBe(true);
        expect(
          gradeExercise(exercise, `${answer} ${currency === 'USD' ? 'RUB' : 'USD'}`).valid,
        ).toBe(false);
        expect(gradeExercise(exercise, `${answer}%`).valid).toBe(false);
      } else if (exercise.unit === 'percent') {
        expect(gradeExercise(exercise, `${answer}%`).correct).toBe(true);
        expect(gradeExercise(exercise, `${answer} bp`).valid).toBe(false);
      } else {
        expect(gradeExercise(exercise, `${answer}%`).valid).toBe(false);
      }
    }
  });
});

describe('fixed numeric teaching answers, independently recalculated', () => {
  it.each(authoredNumeric.map((exercise) => [exercise.id, exercise] as const))(
    '%s',
    (id, exercise) => {
      const reference = numericReferences[id];
      expect(Number.isFinite(reference)).toBe(true);
      expect(exercise.expected).toBeCloseTo(reference, 8);
      expect(gradeExercise(exercise, reference.toFixed(2)).correct).toBe(true);
      expect(gradeExercise(exercise, '').valid).toBe(false);
    },
  );
});

function independentCalculation(
  exercise: CalculationExercise,
  values: Record<string, number>,
): number {
  if (exercise.model === 'future-value')
    return values.initial * (1 + values.rate / 100) ** values.years;
  if (exercise.model === 'present-value')
    return values.amount / (1 + values.rate / 100) ** values.years;
  if (exercise.model === 'real-return')
    return ((100 + values.nominal) / (100 + values.inflation) - 1) * 100;
  return (values.weightA * values.returnA + (100 - values.weightA) * values.returnB) / 100;
}

describe('editable calculation teaching models', () => {
  const calculations = practiceEntries
    .map((entry) => entry.exercise)
    .filter((exercise): exercise is CalculationExercise => exercise.kind === 'calculation');
  it('contains all four models with one independently checked parameter schema per model', () => {
    expect(new Set(calculations.map((exercise) => exercise.model))).toEqual(
      new Set(['future-value', 'present-value', 'real-return', 'portfolio-return']),
    );
  });
  it.each(calculations.map((exercise) => [exercise.id, exercise] as const))(
    '%s grades changed parameters, not only the fixed example',
    (_id, exercise) => {
      const initial = Object.fromEntries(
        exercise.parameters.map((parameter) => [parameter.id, parameter.value]),
      );
      const variants = [initial];
      for (const parameter of exercise.parameters) {
        variants.push({ ...initial, [parameter.id]: parameter.min });
        variants.push({ ...initial, [parameter.id]: parameter.max });
      }
      for (const values of variants) {
        const reference = independentCalculation(exercise, values);
        const answer = {
          ...Object.fromEntries(Object.entries(values).map(([id, value]) => [id, String(value)])),
          result: reference.toFixed(2),
        };
        expect(getCalculationExpected(exercise, answer)).toBeCloseTo(reference, 7);
        expect(gradeExercise(exercise, answer).correct).toBe(true);
      }
    },
  );
});

const oldNumericReferences: Record<string, number> = {
  'm1-money-practice': 10_000 * 1.08,
  'm1-assets-practice': 300_000 + 700_000 - 450_000,
  'm1-income-practice': 85_000 - 62_500,
  'm1-budget-practice': 35_000 * 4,
  'm1-budget-saving-rate': ((90_000 - 72_000) / 90_000) * 100,
  'm1-interest-practice': 20_000 * 1.1 ** 3,
  'm1-inflation-practice': (1.08 / 1.05 - 1) * 100,
  'm1-exam-net-worth': 250_000 + 650_000 - 300_000,
  'm1-exam-savings': ((100_000 - 75_000) / 100_000) * 100,
  'm1-exam-reserve': 50_000 * 5,
  'm1-exam-compound': 50_000 * 1.08 ** 2,
  'm1-exam-real': (1.12 / 1.08 - 1) * 100,
  'm2-percent-practice': ((920 - 800) / 800) * 100,
  'm2-bps-practice': (8.75 - 9.5) * 100,
  'm2-pv-practice': 133_100 / 1.1 ** 3,
  'm2-fv-practice': 50_000 * 1.08 ** 2,
  'm2-dcf-practice': 11_000 / 1.1 + 12_100 / 1.1 ** 2,
  'm2-npv-practice': -50_000 + 60_000 / 1.1,
  'm2-exam-change': ((1_400 - 1_250) / 1_250) * 100,
  'm2-exam-bps': (8.9 - 8.25) * 100,
  'm2-exam-pv': 24_200 / 1.1 ** 2,
  'm2-exam-fv': 30_000 * 1.05 ** 2,
  'm2-exam-dcf': 22_000 / 1.1 + 24_200 / 1.1 ** 2,
  'm2-exam-npv': -38_000 + 22_000 / 1.1 + 24_200 / 1.1 ** 2,
  'm3-securities-practice': 2_000 * 0.07,
  'm3-total-return-practice': ((2_100 - 2_000 + 60) / 2_000) * 100,
  'm3-net-return-practice': ((53_500 - 50_000) / 50_000) * 100,
  'm3-income-practice': (24 / 400) * 100,
  'm3-portfolio-practice': 0.7 * 12 + 0.3 * -4,
  'm3-diversification-practice': Math.sqrt((0.5 * 0.1) ** 2 + (0.5 * 0.1) ** 2) * 100,
  'm3-exam-portfolio': 0.6 * 12 + 0.4 * 3,
  'm3-exam-net': ((108_400 - 400 - 100_000) / 100_000) * 100,
  'm3-exam-total': ((530 - 500 + 20) / 500) * 100,
  'm3-exam-coupon': (80 / 800) * 100,
};
const originalNumeric = lessons
  .flatMap(getExercises)
  .filter((exercise): exercise is NumericExercise => exercise.kind === 'numeric');

describe('0.1 content mathematical audit retained in 0.2', () => {
  it('covers every original numeric answer, including all exam answers', () => {
    expect(new Set(originalNumeric.map((exercise) => exercise.id))).toEqual(
      new Set(Object.keys(oldNumericReferences)),
    );
  });
  it.each(originalNumeric.map((exercise) => [exercise.id, exercise] as const))(
    '%s',
    (id, exercise) => {
      expect(exercise.expected).toBeCloseTo(oldNumericReferences[id], 8);
      expect(gradeExercise(exercise, oldNumericReferences[id].toFixed(2)).correct).toBe(true);
    },
  );
  it('checks the worked NPV/IRR example and the fee-adjusted denominator independently', () => {
    const npv = -100_000 + 60_000 / 1.1 + 60_000 / 1.1 ** 2;
    expect(npv).toBeCloseTo(4_132.23, 2);
    const growthFactorAtIrr = (0.6 + Math.sqrt(0.6 ** 2 + 4 * 0.6)) / 2;
    expect((growthFactorAtIrr - 1) * 100).toBeCloseTo(13.07, 2);
    expect(-100_000 + 60_000 / growthFactorAtIrr + 60_000 / growthFactorAtIrr ** 2).toBeCloseTo(
      0,
      7,
    );
    expect(((111_000 - 101_000) / 101_000) * 100).toBeCloseTo(9.9, 2);
  });
});
