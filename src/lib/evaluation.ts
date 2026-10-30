import type { ErrorType } from './learning-types';
import { futureValue, portfolioReturn, presentValue } from './finance';
import { money, number, percent } from './format';
import type { Answer, CalculationExercise, Exercise, NumericExercise, Unit } from './types';

export type Evaluation = {
  correct: boolean;
  valid: boolean;
  message: string;
  errorType?: ErrorType;
};
type ParsedNumber =
  { valid: true; value: number } | { valid: false; message: string; errorType?: 'unit' | 'format' };
const unitLabels: Record<Unit, string> = {
  number: 'число без единиц',
  percent: 'проценты: 7,5 или 7,5%',
  currency: 'рубли: 1 000 или 1 000 ₽',
  bps: 'базисные пункты: 25 или 25 bp',
};

/**
 * Decimal comma and decimal dot are equivalent. Spaces group thousands.
 * Percent answers use percent points (7.5 means 7.5%); bps are bp counts.
 * Never interpret a percent as a fraction or silently convert another unit.
 */
export function parseNumericAnswer(
  raw: string,
  unit: Unit,
  currency: 'RUB' | 'USD' = 'RUB',
): ParsedNumber {
  let value = raw.trim().replace(/−/gu, '-');
  if (!value) return { valid: false, message: 'Введите ответ перед проверкой.' };
  if (/^[+-]?(?:nan|infinity|∞)$/iu.test(value))
    return { valid: false, message: 'Введите конечное число. NaN и бесконечность не подходят.' };
  if (unit === 'percent') value = value.replace(/\s*%$/u, '').trim();
  if (unit === 'currency') {
    const prefix = currency === 'USD' ? /^\$\s*/u : /^₽\s*/u;
    const suffix = currency === 'USD' ? /\s*(?:\$|usd|долл\.?)$/iu : /\s*(?:₽|руб\.?|rub)$/iu;
    if (prefix.test(value) && suffix.test(value))
      return { valid: false, message: 'Укажите валюту только один раз.', errorType: 'unit' };
    value = value.replace(prefix, '').replace(suffix, '').trim();
  }
  if (unit === 'bps') value = value.replace(/\s*(?:bps?|б\.?\s*п\.?)$/iu, '').trim();
  if (/[%₽$€£\p{L}]/u.test(value)) {
    return {
      valid: false,
      message: `Проверьте единицу измерения. В этом задании нужны ${unit === 'currency' && currency === 'USD' ? 'доллары США: 1 000 или 1 000 USD' : unitLabels[unit]}.`,
      errorType: 'unit',
    };
  }
  // Do not evaluate arbitrary expressions or guess between decimal/thousand commas.
  const numericPattern =
    /^[+-]?(?:(?:\d{1,3}(?:[ \u00a0\u202f\u2009]+\d{3})+|\d+)(?:[,.]\d+)?|[,.]\d+)$/u;
  if (!numericPattern.test(value)) {
    return {
      valid: false,
      message:
        'Введите число с запятой или точкой, например 7,5. Выражения и несколько десятичных разделителей не поддерживаются.',
    };
  }
  const parsed = Number(value.replace(/[ \u00a0\u202f\u2009]/gu, '').replace(',', '.'));
  if (!Number.isFinite(parsed))
    return { valid: false, message: 'Число слишком большое. Введите конечное числовое значение.' };
  return { valid: true, value: parsed };
}

function invalid(message: string, errorType?: ErrorType): Evaluation {
  return { correct: false, valid: false, message, ...(errorType ? { errorType } : {}) };
}
function result(exercise: Exercise, correct: boolean): Evaluation {
  return { correct, valid: true, message: correct ? exercise.explanation : exercise.hint };
}

function gradeNumeric(exercise: NumericExercise, answer: Answer): Evaluation {
  if (typeof answer !== 'string') return invalid('Введите числовой ответ.', 'format');
  const parsed = parseNumericAnswer(answer, exercise.unit, exercise.currency);
  if (!parsed.valid) return invalid(parsed.message, parsed.errorType ?? 'format');
  const absolute = exercise.absoluteTolerance ?? 0.005;
  const relative = exercise.relativeTolerance ?? 0;
  if (
    !Number.isFinite(exercise.expected) ||
    !Number.isFinite(absolute) ||
    !Number.isFinite(relative) ||
    absolute < 0 ||
    relative < 0
  ) {
    return invalid('Не удалось проверить задание: некорректные настройки точности.', 'format');
  }
  const tolerance = Math.max(absolute, Math.abs(exercise.expected) * relative);
  if (!Number.isFinite(tolerance))
    return invalid('Не удалось проверить задание: допуск выходит за численные пределы.', 'format');
  const epsilon =
    Number.EPSILON * Math.max(1, Math.abs(exercise.expected), Math.abs(parsed.value)) * 4;
  return result(exercise, Math.abs(parsed.value - exercise.expected) <= tolerance + epsilon);
}

class CalculationInputError extends RangeError {
  constructor(
    message: string,
    readonly errorType: ErrorType = 'format',
  ) {
    super(message);
  }
}

const calculationParameters: Record<CalculationExercise['model'], readonly string[]> = {
  'future-value': ['initial', 'rate', 'years'],
  'present-value': ['amount', 'rate', 'years'],
  'real-return': ['nominal', 'inflation'],
  'portfolio-return': ['weightA', 'returnA', 'returnB'],
};
const percentageParameters = new Set([
  'rate',
  'nominal',
  'inflation',
  'weightA',
  'returnA',
  'returnB',
]);

function parseCalculationParameters(
  exercise: CalculationExercise,
  answer: Answer,
): Record<string, number> {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer))
    throw new CalculationInputError('Задайте параметры и введите результат расчёта.');
  const expectedIds = calculationParameters[exercise.model];
  if (!expectedIds || !Array.isArray(exercise.parameters))
    throw new CalculationInputError('Не удалось проверить модель расчёта.');
  const expectedUnit =
    exercise.model === 'future-value' || exercise.model === 'present-value'
      ? 'currency'
      : 'percent';
  if (exercise.unit !== expectedUnit)
    throw new CalculationInputError('Единица результата не соответствует модели расчёта.', 'unit');
  const suppliedIds = exercise.parameters.map((parameter) => parameter.id);
  if (
    suppliedIds.length !== expectedIds.length ||
    new Set(suppliedIds).size !== suppliedIds.length ||
    suppliedIds.some((id) => !expectedIds.includes(id))
  )
    throw new CalculationInputError(
      'Не удалось проверить задание: параметры модели заданы некорректно.',
    );
  if (Object.keys(answer).some((id) => id !== 'result' && !expectedIds.includes(id)))
    throw new CalculationInputError('В ответе есть неизвестный параметр.');
  const values: Record<string, number> = {};
  for (const parameter of exercise.parameters) {
    if (
      ![parameter.value, parameter.min, parameter.max, parameter.step].every(Number.isFinite) ||
      parameter.min > parameter.max ||
      parameter.step <= 0 ||
      parameter.value < parameter.min ||
      parameter.value > parameter.max
    )
      throw new CalculationInputError(`Некорректные настройки параметра «${parameter.label}».`);
    const raw = answer[parameter.id];
    if (typeof raw !== 'string')
      throw new CalculationInputError(`Укажите параметр «${parameter.label}».`);
    const unit: Unit = percentageParameters.has(parameter.id)
      ? 'percent'
      : parameter.id === 'years'
        ? 'number'
        : 'currency';
    const parsed = parseNumericAnswer(raw, unit, exercise.currency);
    if (!parsed.valid)
      throw new CalculationInputError(
        `«${parameter.label}»: ${parsed.message}`,
        parsed.errorType ?? 'format',
      );
    const boundaryEpsilon =
      Number.EPSILON *
      Math.max(1, Math.abs(parsed.value), Math.abs(parameter.min), Math.abs(parameter.max)) *
      8;
    if (
      parsed.value < parameter.min - boundaryEpsilon ||
      parsed.value > parameter.max + boundaryEpsilon
    )
      throw new CalculationInputError(
        `«${parameter.label}»: допустимый диапазон от ${number(parameter.min)} до ${number(parameter.max)}.`,
      );
    const steps = (parsed.value - parameter.min) / parameter.step;
    if (
      !Number.isFinite(steps) ||
      Math.abs(steps - Math.round(steps)) > 1e-8 + Number.EPSILON * Math.abs(steps) * 8
    )
      throw new CalculationInputError(
        `«${parameter.label}»: изменяйте значение с шагом ${number(parameter.step, 8)} от ${number(parameter.min, 8)}.`,
      );
    values[parameter.id] = parsed.value;
  }
  return values;
}

function calculateExpected(exercise: CalculationExercise, values: Record<string, number>): number {
  let expected: number;
  if (exercise.model === 'future-value') {
    if (values.initial < 0)
      throw new CalculationInputError('Начальная сумма не может быть отрицательной.');
    expected = futureValue(values.initial, values.rate / 100, values.years);
  } else if (exercise.model === 'present-value') {
    if (values.amount < 0)
      throw new CalculationInputError('Будущая сумма не может быть отрицательной.');
    expected = presentValue(values.amount, values.rate / 100, values.years);
  } else if (exercise.model === 'real-return') {
    if (values.nominal < -100 || values.inflation <= -100)
      throw new CalculationInputError(
        'Номинальная доходность должна быть не ниже −100%, инфляция — выше −100%.',
      );
    expected = ((1 + values.nominal / 100) / (1 + values.inflation / 100) - 1) * 100;
  } else {
    expected =
      portfolioReturn([
        { weight: values.weightA / 100, annualReturn: values.returnA / 100 },
        { weight: 1 - values.weightA / 100, annualReturn: values.returnB / 100 },
      ]) * 100;
  }
  if (!Number.isFinite(expected))
    throw new CalculationInputError('Результат выходит за численные пределы. Проверьте параметры.');
  return Object.is(expected, -0) ? 0 : expected;
}

/** Parameters must all be present. Result is ignored here, allowing a checked solution after grading. */
export function getCalculationExpected(exercise: CalculationExercise, answer: Answer): number {
  return calculateExpected(exercise, parseCalculationParameters(exercise, answer));
}

function calculationSolution(
  exercise: CalculationExercise,
  values: Record<string, number>,
  expected: number,
): string {
  const formatted =
    exercise.unit === 'currency'
      ? exercise.currency === 'USD'
        ? `${number(expected)} USD`
        : money(expected)
      : exercise.unit === 'percent'
        ? percent(expected / 100)
        : number(expected);
  const formula =
    exercise.model === 'future-value'
      ? `FV = ${number(values.initial)} × (1 + ${number(values.rate)} / 100)^${number(values.years)}`
      : exercise.model === 'present-value'
        ? `PV = ${number(values.amount)} / (1 + ${number(values.rate)} / 100)^${number(values.years)}`
        : exercise.model === 'real-return'
          ? `rреал = [(1 + ${number(values.nominal)} / 100) / (1 + ${number(values.inflation)} / 100) − 1] × 100%`
          : `Rₚ = ${number(values.weightA)} / 100 × ${number(values.returnA)}% + ${number(100 - values.weightA)} / 100 × ${number(values.returnB)}%`;
  return `Расчёт для выбранных параметров: ${formula} = ${formatted}. Ставки в формулах роста переводятся из процентов в доли делением на 100.`;
}

export function gradeExercise(exercise: Exercise, answer: Answer): Evaluation {
  if (exercise.kind === 'numeric') return gradeNumeric(exercise, answer);
  if (exercise.kind === 'calculation') {
    try {
      const values = parseCalculationParameters(exercise, answer);
      const expected = calculateExpected(exercise, values);
      const graded = gradeNumeric(
        { ...exercise, kind: 'numeric', expected },
        typeof answer === 'object' && !Array.isArray(answer) ? answer.result : '',
      );
      return {
        ...graded,
        message: graded.correct ? calculationSolution(exercise, values, expected) : graded.message,
        errorType: graded.valid
          ? graded.correct
            ? 'none'
            : 'calculation'
          : (graded.errorType ?? 'format'),
      };
    } catch (caught) {
      return invalid(
        caught instanceof Error ? caught.message : 'Не удалось проверить расчёт.',
        caught instanceof CalculationInputError ? caught.errorType : 'format',
      );
    }
  }
  if (exercise.kind === 'ordering') {
    if (!Array.isArray(answer))
      return invalid('Расположите все элементы в нужном порядке.', 'format');
    if (
      !Array.isArray(exercise.items) ||
      !Array.isArray(exercise.correctOrder) ||
      exercise.items.length === 0
    )
      return invalid(
        'Не удалось проверить задание: список элементов настроен некорректно.',
        'format',
      );
    const itemIds = exercise.items.map((item) => item.id);
    if (
      new Set(itemIds).size !== itemIds.length ||
      exercise.correctOrder.length !== itemIds.length ||
      new Set(exercise.correctOrder).size !== itemIds.length ||
      exercise.correctOrder.some((id) => !itemIds.includes(id))
    )
      return invalid(
        'Не удалось проверить задание: порядок элементов настроен некорректно.',
        'format',
      );
    if (answer.length !== itemIds.length || new Set(answer).size !== itemIds.length)
      return invalid('Используйте каждый элемент ровно один раз.', 'selection');
    if (answer.some((id) => !itemIds.includes(id)))
      return invalid('Выберите элементы из предложенного списка.', 'selection');
    const correct = answer.every((id, index) => id === exercise.correctOrder[index]);
    return { ...result(exercise, correct), errorType: correct ? 'none' : 'ordering' };
  }
  if (exercise.kind === 'boolean') {
    if (answer !== 'true' && answer !== 'false')
      return invalid('Выберите «Верно» или «Неверно» перед проверкой.');
    return result(exercise, answer === String(exercise.correct));
  }
  if (exercise.kind === 'matching') {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer))
      return invalid('Сопоставьте все пары перед проверкой.');
    const ids = exercise.pairs.map((pair) => pair.id);
    const keys = Object.keys(answer);
    const values = Object.values(answer);
    if (keys.some((id) => !ids.includes(id)) || values.some((id) => id !== '' && !ids.includes(id)))
      return invalid('В ответе есть неизвестная пара. Выберите элементы из списка.');
    if (keys.length !== ids.length || values.some((id) => !id))
      return invalid('Сопоставьте все пары перед проверкой.');
    if (new Set(values).size !== values.length)
      return invalid('Каждому термину должно соответствовать отдельное определение.');
    return result(
      exercise,
      ids.every((id) => answer[id] === id),
    );
  }
  const choices =
    typeof answer === 'string' ? (answer ? [answer] : []) : Array.isArray(answer) ? answer : [];
  if (choices.length === 0) return invalid('Выберите ответ перед проверкой.');
  if (!exercise.multiple && choices.length !== 1)
    return invalid('В этом задании выберите один вариант.');
  if (new Set(choices).size !== choices.length)
    return invalid('Один вариант нельзя выбирать несколько раз.');
  if (choices.some((id) => !exercise.options.some((option) => option.id === id)))
    return invalid('Выберите ответ из предложенных вариантов.');
  return result(
    exercise,
    choices.length === exercise.correct.length &&
      exercise.correct.every((id) => choices.includes(id)),
  );
}
