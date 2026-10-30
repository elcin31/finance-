import type { Answer } from './types';
import type { PublicExamQuestion } from './learning-types';
import { parseNumericAnswer } from './evaluation';

/** Input completeness only. Grading keys never enter this validation path. */
export function examInputError(
  question: PublicExamQuestion,
  answer: Answer | undefined,
): string | null {
  const exercise = question.exercise;
  if (exercise.kind === 'numeric') {
    const parsed = parseNumericAnswer(
      typeof answer === 'string' ? answer : '',
      exercise.unit ?? 'number',
      exercise.currency,
    );
    return parsed.valid ? null : parsed.message;
  }
  if (exercise.kind === 'boolean')
    return answer === 'true' || answer === 'false' ? null : 'Выберите «Верно» или «Неверно».';
  if (exercise.kind === 'choice' || exercise.kind === 'scenario') {
    if (
      !Array.isArray(answer) ||
      !answer.length ||
      (!exercise.multiple && answer.length !== 1) ||
      new Set(answer).size !== answer.length ||
      answer.some((id) => !exercise.options?.some((option) => option.id === id))
    )
      return 'Выберите подходящий вариант ответа.';
    return null;
  }
  if (exercise.kind === 'ordering') {
    const ids = exercise.items?.map((item) => item.id) ?? [];
    return Array.isArray(answer) &&
      answer.length === ids.length &&
      new Set(answer).size === ids.length &&
      answer.every((id) => ids.includes(id))
      ? null
      : 'Расположите все элементы в последовательности.';
  }
  return 'Этот формат экзамена требует обновления приложения.';
}
