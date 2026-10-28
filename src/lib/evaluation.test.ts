import { describe, expect, it } from 'vitest';
import { gradeExercise, parseNumericAnswer } from './evaluation';
import type {
  Answer,
  ChoiceExercise,
  ExerciseBase,
  MatchingExercise,
  NumericExercise,
  Unit,
} from './types';

const base: ExerciseBase = {
  id: 'test',
  prompt: 'Вопрос',
  hint: 'Подсказка без готового ответа.',
  explanation: 'Проверенное решение.',
  skills: ['mathematics'],
};
const numeric: NumericExercise = { ...base, kind: 'numeric', expected: 7.5, unit: 'percent' };
const choice: ChoiceExercise = {
  ...base,
  kind: 'choice',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  correct: ['b'],
};
const matching: MatchingExercise = {
  ...base,
  kind: 'matching',
  pairs: [
    { id: 'asset', left: 'Asset', right: 'Актив' },
    { id: 'liability', left: 'Liability', right: 'Обязательство' },
  ],
};

describe('parseNumericAnswer', () => {
  it.each([
    ['7,5', 'percent', 7.5],
    ['7.5%', 'percent', 7.5],
    ['  7,5 % ', 'percent', 7.5],
    ['1 000,50 ₽', 'currency', 1000.5],
    ['₽1\u202f000.50', 'currency', 1000.5],
    ['1000 руб.', 'currency', 1000],
    ['1000 RUB', 'currency', 1000],
    ['25 bp', 'bps', 25],
    ['25bps', 'bps', 25],
    ['25 б.п.', 'bps', 25],
    ['−12,5', 'number', -12.5],
    ['+0.5', 'number', 0.5],
    [',5', 'number', 0.5],
    ['1\u00a0000', 'number', 1000],
    ['1\u2009000', 'number', 1000],
  ] satisfies [string, Unit, number][])('parses %s as %s', (raw, unit, expected) => {
    expect(parseNumericAnswer(raw, unit)).toEqual({ valid: true, value: expected });
  });

  it.each([
    '',
    '   ',
    '.',
    '7,',
    '1,2,3',
    '1.2.3',
    '1,234.56',
    '1/0',
    '1_000',
    '1 2',
    '1e3',
    'NaN',
    'Infinity',
    '-Infinity',
    '∞',
    '9'.repeat(400),
  ])('rejects invalid numeric input %s', (raw) => {
    expect(parseNumericAnswer(raw, 'number').valid).toBe(false);
  });

  it.each([
    ['7.5%', 'currency'],
    ['7.5 ₽', 'percent'],
    ['25%', 'bps'],
    ['25bp', 'percent'],
    ['25%', 'number'],
    ['100 USD', 'currency'],
    ['₽100 ₽', 'currency'],
  ] satisfies [string, Unit][])('rejects mismatched units: %s / %s', (raw, unit) => {
    expect(parseNumericAnswer(raw, unit).valid).toBe(false);
  });
});

describe('gradeExercise numeric', () => {
  it('interprets 7.5 as 7.5%, not as a fraction', () => {
    expect(gradeExercise(numeric, '7,5%')).toEqual({
      correct: true,
      valid: true,
      message: base.explanation,
    });
    expect(gradeExercise(numeric, '0.075')).toEqual({
      correct: false,
      valid: true,
      message: base.hint,
    });
  });

  it('checks absolute and relative rounding tolerance, including its boundary', () => {
    expect(
      gradeExercise({ ...numeric, expected: 10, absoluteTolerance: 0.01 }, '10.01').correct,
    ).toBe(true);
    expect(
      gradeExercise({ ...numeric, expected: 10, absoluteTolerance: 0.01 }, '10.011').correct,
    ).toBe(false);
    expect(
      gradeExercise(
        { ...numeric, expected: 1000, absoluteTolerance: 0, relativeTolerance: 0.001 },
        '1001',
      ).correct,
    ).toBe(true);
    expect(
      gradeExercise(
        { ...numeric, expected: 1000, absoluteTolerance: 0, relativeTolerance: 0.001 },
        '1001.01',
      ).correct,
    ).toBe(false);
    expect(gradeExercise({ ...numeric, expected: 1 / 3, unit: 'number' }, '0,33').correct).toBe(
      true,
    );
  });

  it('does not divide by zero for a zero or negative expected answer', () => {
    expect(
      gradeExercise({ ...numeric, expected: 0, absoluteTolerance: 0, relativeTolerance: 0.01 }, '0')
        .correct,
    ).toBe(true);
    expect(
      gradeExercise(
        { ...numeric, expected: 0, absoluteTolerance: 0, relativeTolerance: 0.01 },
        '0.001',
      ).correct,
    ).toBe(false);
    expect(
      gradeExercise(
        { ...numeric, expected: -100, absoluteTolerance: 0, relativeTolerance: 0.01 },
        '-99',
      ).correct,
    ).toBe(true);
  });

  it('distinguishes incomplete or invalid input from a valid wrong answer', () => {
    expect(gradeExercise(numeric, '').valid).toBe(false);
    expect(gradeExercise(numeric, 'Infinity').valid).toBe(false);
    expect(gradeExercise(numeric, '5 ₽').valid).toBe(false);
    expect(gradeExercise(numeric, ['7.5']).valid).toBe(false);
    expect(gradeExercise(numeric, '4').valid).toBe(true);
    expect(gradeExercise(numeric, '4').message).toBe(base.hint);
    expect(gradeExercise(numeric, '4').message).not.toContain(base.explanation);
  });

  it.each([
    { expected: NaN },
    { expected: Infinity },
    { absoluteTolerance: -1 },
    { relativeTolerance: NaN },
    { absoluteTolerance: Infinity },
    { expected: 1e308, relativeTolerance: 1e308 },
  ])('rejects invalid exercise precision %o', (changes) => {
    expect(gradeExercise({ ...numeric, ...changes }, '7.5').valid).toBe(false);
  });
});

describe('gradeExercise choice, scenario, boolean and matching', () => {
  it('requires exact stable option ids', () => {
    expect(gradeExercise(choice, ['b']).correct).toBe(true);
    expect(gradeExercise(choice, 'b').correct).toBe(true);
    expect(gradeExercise({ ...choice, kind: 'scenario' }, ['b']).correct).toBe(true);
    expect(gradeExercise(choice, ['a'])).toEqual({
      valid: true,
      correct: false,
      message: base.hint,
    });
    expect(gradeExercise(choice, 'B').valid).toBe(false);
    expect(gradeExercise(choice, []).valid).toBe(false);
    expect(gradeExercise(choice, ['a', 'b']).valid).toBe(false);
  });

  it('compares unordered multiple selections without accepting subsets, supersets or duplicates', () => {
    const multiple = { ...choice, multiple: true, correct: ['a', 'c'] };
    expect(gradeExercise(multiple, ['c', 'a']).correct).toBe(true);
    expect(gradeExercise(multiple, ['a']).correct).toBe(false);
    expect(gradeExercise(multiple, ['a', 'b', 'c']).correct).toBe(false);
    expect(gradeExercise(multiple, ['a', 'a', 'c']).valid).toBe(false);
  });

  it('requires the explicit string representation of a boolean', () => {
    const boolean = { ...base, kind: 'boolean' as const, correct: true };
    expect(gradeExercise(boolean, 'true').correct).toBe(true);
    expect(gradeExercise(boolean, 'false').valid).toBe(true);
    expect(gradeExercise(boolean, 'false').correct).toBe(false);
    expect(gradeExercise(boolean, 'True').valid).toBe(false);
    expect(gradeExercise(boolean, true as unknown as Answer).valid).toBe(false);
  });

  it('checks complete pair mappings independent of insertion order', () => {
    expect(gradeExercise(matching, { liability: 'liability', asset: 'asset' }).correct).toBe(true);
    expect(gradeExercise(matching, { liability: 'asset', asset: 'liability' })).toEqual({
      valid: true,
      correct: false,
      message: base.hint,
    });
    expect(gradeExercise(matching, { asset: 'asset' }).valid).toBe(false);
    expect(gradeExercise(matching, { liability: '', asset: 'asset' }).valid).toBe(false);
    expect(gradeExercise(matching, { liability: 'unknown', asset: 'asset' }).valid).toBe(false);
    expect(gradeExercise(matching, { liability: 'asset', asset: 'asset' }).valid).toBe(false);
    expect(gradeExercise(matching, ['asset', 'liability']).valid).toBe(false);
    expect(
      gradeExercise(matching, { liability: 'liability', asset: 'asset', extra: 'asset' }).valid,
    ).toBe(false);
  });
});
