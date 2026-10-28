import type { Exercise, LearningModule, Lesson, Term } from '@/lib/types';
import { exercises } from './builders';
import { module1Lessons } from './module1';
import { module2Lessons } from './module2';
import { module3Lessons } from './module3';

/** Content v1: IDs remain stable across editorial updates. Breaking exercise changes require a version bump. */
export const lessons: Lesson[] = [...module1Lessons, ...module2Lessons, ...module3Lessons];

export const modules: LearningModule[] = [
  {
    id: 'm1',
    title: 'Основы финансов',
    english: 'Fundamentals of Finance',
    description:
      'Деньги, личный баланс, бюджет и покупательная способность. Соберите основу для осознанных финансовых решений.',
    color: 'emerald',
    lessonIds: module1Lessons.map((item) => item.id),
  },
  {
    id: 'm2',
    title: 'Финансовая математика',
    english: 'Financial Mathematics',
    description:
      'Проценты, стоимость денег во времени и оценка денежных потоков. Научитесь обосновывать расчётом.',
    color: 'teal',
    lessonIds: module2Lessons.map((item) => item.id),
  },
  {
    id: 'm3',
    title: 'Введение в инвестиции',
    english: 'Investment Fundamentals',
    description:
      'Акции, облигации, полная доходность и портфель. Изучите источники результата и пределы диверсификации.',
    color: 'blue',
    lessonIds: module3Lessons.map((item) => item.id),
  },
];

const vocabulary = new Map<string, Term>();
for (const item of lessons) {
  for (const term of item.terms) {
    const key = term.en.toLocaleLowerCase('en');
    if (!vocabulary.has(key)) vocabulary.set(key, term);
  }
}
export const terms: Term[] = [...vocabulary.values()].sort((a, b) =>
  a.en.localeCompare(b.en, 'en'),
);

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((item) => item.id === id);
}

export function getExercises(lesson: Lesson): Exercise[] {
  return exercises(lesson);
}
