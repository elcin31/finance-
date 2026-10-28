import type { Exercise, Lesson, LessonBlock, SkillId, Term, Unit } from '@/lib/types';

export function text(id: string, title: string, ...paragraphs: string[]): LessonBlock {
  return { id, type: 'text', title, paragraphs };
}
export function formula(
  id: string,
  title: string,
  expression: string,
  variables: Record<string, string>,
  note?: string,
): LessonBlock {
  return {
    id,
    type: 'formula',
    title,
    expression,
    variables: Object.entries(variables).map(([symbol, meaning]) => ({ symbol, meaning })),
    note,
  };
}
export function example(
  id: string,
  title: string,
  description: string,
  steps: string[],
  result: string,
): LessonBlock {
  return { id, type: 'example', title, description, steps, result };
}
export function interactive(
  id: string,
  title: string,
  mode: 'compound' | 'discount' | 'portfolio',
  description: string,
): LessonBlock {
  return { id, type: 'interactive', title, mode, description };
}
export function summary(id: string, ...points: string[]): LessonBlock {
  return { id, type: 'summary', title: 'Что стоит запомнить', points };
}
export function numeric(
  id: string,
  prompt: string,
  expected: number,
  unit: Unit,
  hint: string,
  explanation: string,
  skills: SkillId[],
  tolerance = 0.01,
): LessonBlock {
  return {
    id,
    type: 'exercise',
    exercise: {
      id,
      kind: 'numeric',
      prompt,
      expected,
      unit,
      absoluteTolerance: tolerance,
      hint,
      explanation,
      skills,
    },
  };
}
export function choice(
  id: string,
  prompt: string,
  options: string[],
  correct: number | number[],
  hint: string,
  explanation: string,
  skills: SkillId[],
  scenario = false,
): LessonBlock {
  const answers = Array.isArray(correct) ? correct : [correct];
  return {
    id,
    type: 'exercise',
    exercise: {
      id,
      kind: scenario ? 'scenario' : 'choice',
      prompt,
      options: options.map((label, index) => ({ id: String(index), label })),
      correct: answers.map(String),
      multiple: Array.isArray(correct),
      hint,
      explanation,
      skills,
    },
  };
}
export function boolean(
  id: string,
  prompt: string,
  correct: boolean,
  hint: string,
  explanation: string,
  skills: SkillId[],
): LessonBlock {
  return {
    id,
    type: 'exercise',
    exercise: { id, kind: 'boolean', prompt, correct, hint, explanation, skills },
  };
}
export function matching(
  id: string,
  prompt: string,
  pairs: [string, string][],
  hint: string,
  explanation: string,
  skills: SkillId[] = ['english'],
): LessonBlock {
  return {
    id,
    type: 'exercise',
    exercise: {
      id,
      kind: 'matching',
      prompt,
      pairs: pairs.map(([left, right], index) => ({ id: String(index), left, right })),
      hint,
      explanation,
      skills,
    },
  };
}
export function lesson(
  data: Omit<Lesson, 'version' | 'terms'>,
  vocabulary: [string, string, string, string][],
): Lesson {
  return {
    ...data,
    version: 1,
    terms: vocabulary.map(([en, ru, definition, context]): Term => ({
      en,
      ru,
      definition,
      context,
      lessonId: data.id,
    })),
  };
}
export function exercises(lessonData: Lesson): Exercise[] {
  return lessonData.blocks.flatMap((block) => (block.type === 'exercise' ? [block.exercise] : []));
}
