import type { Answer, Exercise, Unit } from './types';

export type Evaluation = { correct: boolean; valid: boolean; message: string };
type ParsedNumber = { valid: true; value: number } | { valid: false; message: string };
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
export function parseNumericAnswer(raw: string, unit: Unit): ParsedNumber {
  let value = raw.trim().replace(/−/gu, '-');
  if (!value) return { valid: false, message: 'Введите ответ перед проверкой.' };
  if (/^[+-]?(?:nan|infinity|∞)$/iu.test(value))
    return { valid: false, message: 'Введите конечное число. NaN и бесконечность не подходят.' };
  if (unit === 'percent') value = value.replace(/\s*%$/u, '').trim();
  if (unit === 'currency') {
    if (/^₽/u.test(value) && /(?:₽|руб\.?|rub)$/iu.test(value))
      return { valid: false, message: 'Укажите валюту только один раз.' };
    value = value
      .replace(/^₽\s*/u, '')
      .replace(/\s*(?:₽|руб\.?|rub)$/iu, '')
      .trim();
  }
  if (unit === 'bps') value = value.replace(/\s*(?:bps?|б\.?\s*п\.?)$/iu, '').trim();
  if (/[%₽$€£\p{L}]/u.test(value)) {
    return {
      valid: false,
      message: `Проверьте единицу измерения. В этом задании нужны ${unitLabels[unit]}.`,
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

function invalid(message: string): Evaluation {
  return { correct: false, valid: false, message };
}
function result(exercise: Exercise, correct: boolean): Evaluation {
  return { correct, valid: true, message: correct ? exercise.explanation : exercise.hint };
}

export function gradeExercise(exercise: Exercise, answer: Answer): Evaluation {
  if (exercise.kind === 'numeric') {
    if (typeof answer !== 'string') return invalid('Введите числовой ответ.');
    const parsed = parseNumericAnswer(answer, exercise.unit);
    if (!parsed.valid) return invalid(parsed.message);
    const absolute = exercise.absoluteTolerance ?? 0.005;
    const relative = exercise.relativeTolerance ?? 0;
    if (
      !Number.isFinite(exercise.expected) ||
      !Number.isFinite(absolute) ||
      !Number.isFinite(relative) ||
      absolute < 0 ||
      relative < 0
    ) {
      return invalid('Не удалось проверить задание: некорректные настройки точности.');
    }
    const tolerance = Math.max(absolute, Math.abs(exercise.expected) * relative);
    if (!Number.isFinite(tolerance))
      return invalid('Не удалось проверить задание: допуск выходит за численные пределы.');
    const epsilon =
      Number.EPSILON * Math.max(1, Math.abs(exercise.expected), Math.abs(parsed.value)) * 4;
    return result(exercise, Math.abs(parsed.value - exercise.expected) <= tolerance + epsilon);
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
