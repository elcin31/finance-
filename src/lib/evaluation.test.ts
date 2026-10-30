import { describe, expect, it } from 'vitest';
import { getCalculationExpected, gradeExercise, parseNumericAnswer } from './evaluation';
import type {
  Answer,
  CalculationExercise,
  ChoiceExercise,
  ExerciseBase,
  MatchingExercise,
  NumericExercise,
  OrderingExercise,
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

describe('explicit answer currency', () => {
  it.each(['1000', '$1000', '1 000 USD', '1000 $', '1000 долл.', '$1\u202f000,00'])(
    'accepts USD notation %s only for USD',
    (raw) => {
      expect(parseNumericAnswer(raw, 'currency', 'USD')).toEqual({ valid: true, value: 1000 });
      if (raw !== '1000') expect(parseNumericAnswer(raw, 'currency', 'RUB').valid).toBe(false);
    },
  );
  it.each(['1000 ₽', '₽1000', '1000 RUB', '1000 руб.', '$1000 USD', '$1000 $', '1000 EUR'])(
    'rejects foreign or duplicate USD units %s',
    (raw) => {
      expect(parseNumericAnswer(raw, 'currency', 'USD')).toMatchObject({
        valid: false,
        errorType: 'unit',
      });
    },
  );
  it('grades a USD amount without treating a RUB answer as equivalent', () => {
    const dollars: NumericExercise = {
      ...numeric,
      unit: 'currency',
      currency: 'USD',
      expected: 1000,
    };
    expect(gradeExercise(dollars, '$1 000').correct).toBe(true);
    expect(gradeExercise(dollars, '1 000 ₽')).toMatchObject({ valid: false, errorType: 'unit' });
    expect(gradeExercise({ ...dollars, currency: 'RUB' }, '1 000 USD')).toMatchObject({
      valid: false,
      errorType: 'unit',
    });
  });
});

describe('ordering evaluation', () => {
  const ordering: OrderingExercise = {
    ...base,
    kind: 'ordering',
    items: [
      { id: 'discount', label: 'Дисконтировать потоки' },
      { id: 'sum', label: 'Сложить PV' },
      { id: 'invest', label: 'Вычесть начальное вложение' },
    ],
    correctOrder: ['discount', 'sum', 'invest'],
  };
  it('compares a complete permutation in order', () => {
    expect(gradeExercise(ordering, ['discount', 'sum', 'invest'])).toMatchObject({
      valid: true,
      correct: true,
      errorType: 'none',
      message: base.explanation,
    });
    expect(gradeExercise(ordering, ['sum', 'discount', 'invest'])).toMatchObject({
      valid: true,
      correct: false,
      errorType: 'ordering',
      message: base.hint,
    });
  });
  it.each(
    (
      [
        [],
        ['discount'],
        ['discount', 'discount', 'invest'],
        ['discount', 'sum', 'unknown'],
        ['discount', 'sum', 'invest', 'extra'],
        'discount',
        { discount: '1' },
      ] satisfies Answer[]
    ).map((answer) => ({ answer })),
  )('rejects a missing, duplicate or unknown element: $answer', ({ answer }) => {
    expect(gradeExercise(ordering, answer).valid).toBe(false);
  });
  it('does not accept malformed content as a completed ordering', () => {
    expect(gradeExercise({ ...ordering, items: [], correctOrder: [] }, []).valid).toBe(false);
    expect(
      gradeExercise({ ...ordering, correctOrder: ['sum', 'sum', 'invest'] }, [
        'discount',
        'sum',
        'invest',
      ]).valid,
    ).toBe(false);
  });
});

const futureCalculation: CalculationExercise = {
  ...base,
  kind: 'calculation',
  model: 'future-value',
  unit: 'currency',
  parameters: [
    {
      id: 'initial',
      label: 'Начальная сумма',
      value: 1000,
      min: 0,
      max: 1000000,
      step: 100,
      unit: '₽',
    },
    { id: 'rate', label: 'Годовая ставка', value: 10, min: -50, max: 50, step: 0.5, unit: '%' },
    { id: 'years', label: 'Срок', value: 2, min: 0, max: 100, step: 1, unit: 'лет' },
  ],
};
const futureAnswer = { initial: '1000', rate: '10', years: '2', result: '1210' };
const invalidCalculationAnswers: Answer[] = [
  '',
  [],
  {},
  { result: '1210' },
  { ...futureAnswer, initial: '' },
  { ...futureAnswer, rate: 'Infinity' },
  { ...futureAnswer, rate: 'NaN' },
  { ...futureAnswer, rate: '1/0' },
  { ...futureAnswer, initial: '-100' },
  { ...futureAnswer, years: '101' },
  { ...futureAnswer, rate: '10.1' },
  { ...futureAnswer, years: '1.5' },
  { ...futureAnswer, extra: '123' },
  { ...futureAnswer, result: 'Infinity' },
  { ...futureAnswer, result: '' },
];

describe('interactive calculation evaluation', () => {
  it('checks the submitted parameter combination rather than the defaults', () => {
    const changed = { initial: '2000 ₽', rate: '7,5%', years: '3', result: '2484,59 ₽' };
    expect(getCalculationExpected(futureCalculation, changed)).toBeCloseTo(2000 * 1.075 ** 3, 8);
    expect(gradeExercise(futureCalculation, changed)).toMatchObject({
      valid: true,
      correct: true,
      errorType: 'none',
    });
    expect(gradeExercise(futureCalculation, changed).message).toMatch(/2\s000/u);
    expect(gradeExercise(futureCalculation, { ...changed, result: '1210' })).toMatchObject({
      valid: true,
      correct: false,
      errorType: 'calculation',
      message: base.hint,
    });
  });
  it('preserves absolute tolerance and supports zero and negative rates', () => {
    expect(gradeExercise(futureCalculation, { ...futureAnswer, result: '1210,005' }).correct).toBe(
      true,
    );
    expect(gradeExercise(futureCalculation, { ...futureAnswer, result: '1210,006' }).correct).toBe(
      false,
    );
    expect(
      gradeExercise(futureCalculation, { ...futureAnswer, rate: '0', result: '1000' }).correct,
    ).toBe(true);
    expect(
      gradeExercise(futureCalculation, { ...futureAnswer, rate: '-10', result: '810' }).correct,
    ).toBe(true);
    expect(
      gradeExercise(futureCalculation, { ...futureAnswer, initial: '0', result: '0' }).correct,
    ).toBe(true);
  });
  it.each(invalidCalculationAnswers.map((answer) => ({ answer })))(
    'rejects missing, malformed, out-of-bounds and off-step data $answer',
    ({ answer }) => {
      expect(gradeExercise(futureCalculation, answer).valid).toBe(false);
    },
  );
  it('distinguishes incorrect units from arithmetic errors', () => {
    expect(gradeExercise(futureCalculation, { ...futureAnswer, rate: '10 bp' })).toMatchObject({
      valid: false,
      errorType: 'unit',
    });
    expect(gradeExercise(futureCalculation, { ...futureAnswer, result: '1210%' })).toMatchObject({
      valid: false,
      errorType: 'unit',
    });
    expect(gradeExercise(futureCalculation, { ...futureAnswer, result: '$1210' })).toMatchObject({
      valid: false,
      errorType: 'unit',
    });
    expect(
      gradeExercise(
        { ...futureCalculation, currency: 'USD' },
        { ...futureAnswer, initial: '$1000', result: '$1210' },
      ).correct,
    ).toBe(true);
  });
  it('rejects invalid model settings and division by zero safely', () => {
    expect(
      gradeExercise(
        {
          ...futureCalculation,
          parameters: [
            { ...futureCalculation.parameters[0], step: 0 },
            ...futureCalculation.parameters.slice(1),
          ],
        },
        futureAnswer,
      ).valid,
    ).toBe(false);
    expect(
      gradeExercise(
        {
          ...futureCalculation,
          parameters: [
            { ...futureCalculation.parameters[0], min: NaN },
            ...futureCalculation.parameters.slice(1),
          ],
        },
        futureAnswer,
      ).valid,
    ).toBe(false);
    expect(
      gradeExercise(
        {
          ...futureCalculation,
          parameters: [
            futureCalculation.parameters[0],
            futureCalculation.parameters[0],
            futureCalculation.parameters[2],
          ],
        },
        futureAnswer,
      ).valid,
    ).toBe(false);
    expect(gradeExercise({ ...futureCalculation, unit: 'percent' }, futureAnswer)).toMatchObject({
      valid: false,
      errorType: 'unit',
    });
    const invalidRate = {
      ...futureCalculation,
      parameters: futureCalculation.parameters.map((p) =>
        p.id === 'rate' ? { ...p, min: -100 } : p,
      ),
    };
    expect(gradeExercise(invalidRate, { ...futureAnswer, rate: '-100' }).valid).toBe(false);
    expect(() => getCalculationExpected(futureCalculation, {})).toThrow(RangeError);
  });
  it('discounts one future payment using the supplied parameters', () => {
    const exercise: CalculationExercise = {
      ...futureCalculation,
      model: 'present-value',
      parameters: futureCalculation.parameters.map((p) =>
        p.id === 'initial' ? { ...p, id: 'amount', value: 1200 } : p,
      ),
    };
    expect(
      getCalculationExpected(exercise, { amount: '121000', rate: '10', years: '2' }),
    ).toBeCloseTo(100000, 8);
    expect(
      gradeExercise(exercise, { amount: '121000', rate: '10', years: '2', result: '100000' })
        .correct,
    ).toBe(true);
  });
  it('uses the exact Fisher relation and blocks an inflation divisor of zero', () => {
    const exercise: CalculationExercise = {
      ...base,
      kind: 'calculation',
      model: 'real-return',
      unit: 'percent',
      parameters: [
        {
          id: 'nominal',
          label: 'Номинальная доходность',
          value: 10,
          min: -100,
          max: 100,
          step: 0.5,
          unit: '%',
        },
        { id: 'inflation', label: 'Инфляция', value: 6, min: -100, max: 100, step: 0.5, unit: '%' },
      ],
    };
    expect(getCalculationExpected(exercise, { nominal: '10%', inflation: '6%' })).toBeCloseTo(
      3.77358490566,
      8,
    );
    expect(
      gradeExercise(exercise, { nominal: '10', inflation: '6', result: '3,77%' }).correct,
    ).toBe(true);
    expect(gradeExercise(exercise, { nominal: '10', inflation: '6', result: '4%' }).correct).toBe(
      false,
    );
    expect(
      gradeExercise(exercise, { nominal: '-100', inflation: '6', result: '-100' }).correct,
    ).toBe(true);
    expect(gradeExercise(exercise, { nominal: '10', inflation: '-100', result: '0' }).valid).toBe(
      false,
    );
  });
  it('derives the second portfolio weight and handles negative returns', () => {
    const exercise: CalculationExercise = {
      ...base,
      kind: 'calculation',
      model: 'portfolio-return',
      unit: 'percent',
      parameters: [
        { id: 'weightA', label: 'Вес A', value: 60, min: 0, max: 100, step: 5, unit: '%' },
        {
          id: 'returnA',
          label: 'Доходность A',
          value: 10,
          min: -100,
          max: 100,
          step: 1,
          unit: '%',
        },
        {
          id: 'returnB',
          label: 'Доходность B',
          value: -5,
          min: -100,
          max: 100,
          step: 1,
          unit: '%',
        },
      ],
    };
    expect(
      getCalculationExpected(exercise, { weightA: '60', returnA: '10', returnB: '-5' }),
    ).toBeCloseTo(4, 8);
    expect(
      gradeExercise(exercise, { weightA: '60', returnA: '10', returnB: '-5', result: '4%' })
        .correct,
    ).toBe(true);
    expect(
      gradeExercise(exercise, { weightA: '105', returnA: '10', returnB: '-5', result: '4%' }).valid,
    ).toBe(false);
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
