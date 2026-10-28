import { describe, expect, it } from 'vitest';
import { gradeExercise } from '@/lib/evaluation';
import { getExercises, getLesson, lessons, modules, terms } from './curriculum';

describe('curriculum v1 integrity', () => {
  it('provides eighteen lessons and three exams without dangling module links', () => {
    expect(lessons.filter((lesson) => !lesson.exam)).toHaveLength(18);
    expect(lessons.filter((lesson) => lesson.exam)).toHaveLength(3);
    const linked = modules.flatMap((module) => module.lessonIds);
    expect(new Set(linked).size).toBe(lessons.length);
    for (const module of modules) {
      expect(module.lessonIds).toHaveLength(7);
      for (const id of module.lessonIds) expect(getLesson(id)?.moduleId).toBe(module.id);
    }
    expect(getLesson('not-a-lesson')).toBeUndefined();
  });

  it('keeps all lesson and exercise identifiers unique', () => {
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    const ids = lessons.flatMap(getExercises).map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of lessons) {
      expect(new Set(lesson.blocks.map((block) => block.id)).size).toBe(lesson.blocks.length);
      expect(lesson.version).toBeGreaterThan(0);
    }
  });

  it('requires substantive practice and complete editorial explanations', () => {
    for (const lesson of lessons) {
      const exercises = getExercises(lesson);
      expect(exercises.length).toBeGreaterThanOrEqual(lesson.exam ? 6 : 4);
      expect(exercises.some((exercise) => exercise.kind === 'numeric')).toBe(true);
      expect(lesson.blocks.some((block) => block.type === 'summary')).toBe(true);
      expect(lesson.terms.length).toBeGreaterThan(0);
      if (!lesson.exam) {
        expect(lesson.blocks.some((block) => block.type === 'formula')).toBe(true);
        expect(lesson.blocks.some((block) => block.type === 'example')).toBe(true);
      }
      for (const exercise of exercises) {
        expect(exercise.hint.trim()).not.toBe('');
        expect(exercise.explanation.trim()).not.toBe('');
        expect(exercise.explanation).not.toBe(exercise.hint);
        expect(exercise.skills.length).toBeGreaterThan(0);
        if (exercise.kind === 'choice' || exercise.kind === 'scenario') {
          expect(exercise.correct.length).toBeGreaterThan(0);
          for (const id of exercise.correct)
            expect(exercise.options.some((option) => option.id === id)).toBe(true);
        }
      }
    }
  });

  it('deduplicates library terminology and links it to real lessons', () => {
    expect(terms.length).toBeGreaterThan(50);
    expect(new Set(terms.map((term) => term.en.toLowerCase())).size).toBe(terms.length);
    for (const term of terms) {
      expect(getLesson(term.lessonId)).toBeDefined();
      expect(term.definition.length).toBeGreaterThan(20);
      expect(term.context.length).toBeGreaterThan(20);
    }
  });
});

describe('independently recalculated teaching answers', () => {
  const cases: [string, string, number][] = [
    ['m1-money', 'm1-money-practice', 10_000 * 1.08],
    ['m1-assets', 'm1-assets-practice', 300_000 + 700_000 - 450_000],
    ['m1-budget', 'm1-budget-saving-rate', ((90_000 - 72_000) / 90_000) * 100],
    ['m1-interest', 'm1-interest-practice', 20_000 * 1.1 ** 3],
    ['m1-inflation', 'm1-inflation-practice', (1.08 / 1.05 - 1) * 100],
    ['m2-percent', 'm2-percent-practice', (920 / 800 - 1) * 100],
    ['m2-bps', 'm2-bps-practice', (8.75 - 9.5) * 100],
    ['m2-pv', 'm2-pv-practice', 133_100 / 1.1 ** 3],
    ['m2-fv', 'm2-fv-practice', 50_000 * 1.08 ** 2],
    ['m2-dcf', 'm2-dcf-practice', 11_000 / 1.1 + 12_100 / 1.1 ** 2],
    ['m2-npv', 'm2-npv-practice', -50_000 + 60_000 / 1.1],
    ['m3-securities', 'm3-securities-practice', 2_000 * 0.07],
    ['m3-total-return', 'm3-total-return-practice', ((2_100 - 2_000 + 60) / 2_000) * 100],
    ['m3-net-return', 'm3-net-return-practice', ((53_500 - 50_000) / 50_000) * 100],
    ['m3-income', 'm3-income-practice', (24 / 400) * 100],
    ['m3-portfolio', 'm3-portfolio-practice', 0.7 * 12 + 0.3 * -4],
    [
      'm3-diversification',
      'm3-diversification-practice',
      Math.sqrt(0.5 ** 2 * 0.1 ** 2 + 0.5 ** 2 * 0.1 ** 2) * 100,
    ],
  ];
  it.each(cases)('%s has a correct numeric practice answer', (lessonId, exerciseId, calculated) => {
    const lesson = getLesson(lessonId);
    expect(lesson).toBeDefined();
    const exercise = getExercises(lesson!).find((item) => item.id === exerciseId);
    expect(exercise?.kind).toBe('numeric');
    if (exercise?.kind !== 'numeric') throw new Error('Missing numeric practice');
    expect(exercise.expected).toBeCloseTo(calculated, 8);
    expect(gradeExercise(exercise, calculated.toFixed(2)).correct).toBe(true);
  });
});
