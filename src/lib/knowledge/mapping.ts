import { isCompetencyId } from '@/content/skills';
import type { CompetencyId } from '../learning-types';
import type { Exercise } from '../types';

const exact: Record<string, CompetencyId[]> = {
  'm1-money-practice': ['interest-rates', 'future-value'],
  'm1-income-scenario': ['returns', 'stocks'],
  'm1-interest-practice': ['compounding', 'future-value'],
  'm1-interest-effective': ['interest-rates', 'compounding'],
  'm1-inflation-practice': ['inflation', 'returns'],
  'm1-inflation-scenario': ['inflation', 'returns'],
  'm2-percent-practice': ['interest-rates', 'returns'],
  'm2-percent-sequence': ['interest-rates', 'compounding'],
  'm2-pv-practice': ['present-value', 'discounting'],
  'm2-pv-rate': ['present-value', 'discounting'],
  'm2-pv-scenario': ['present-value', 'discounting'],
  'm2-fv-practice': ['future-value', 'compounding'],
  'm2-fv-contribution': ['future-value', 'compounding'],
  'm2-fv-scenario': ['future-value', 'risk-return'],
  'm2-dcf-scenario': ['discounting', 'present-value'],
  'm2-npv-practice': ['npv'],
  'm2-npv-rule': ['npv'],
  'm2-npv-irr-unique': ['irr'],
  'm2-npv-scenario': ['npv', 'irr'],
  'm3-securities-practice': ['bonds', 'dividends'],
  'm3-securities-rights': ['stocks', 'bonds'],
  'm3-securities-safe': ['bonds', 'risk-return'],
  'm3-securities-scenario': ['bonds', 'discounting'],
  'm3-total-return-components': ['returns', 'dividends'],
  'm3-income-practice': ['dividends', 'stocks'],
  'm3-income-denominator': ['dividends', 'bonds'],
  'm3-income-dividend': ['dividends', 'risk-return'],
  'm3-income-scenario': ['bonds', 'discounting'],
  'm3-diversification-practice': ['diversification', 'risk-return'],
  'm3-diversification-scenario': ['diversification', 'risk-return'],
  'm1-exam-net-worth': ['financial-literacy'],
  'm1-exam-savings': ['financial-literacy'],
  'm1-exam-reserve': ['financial-literacy'],
  'm1-exam-loan': ['financial-literacy'],
  'm1-exam-compound': ['compounding', 'future-value'],
  'm1-exam-real': ['inflation', 'returns'],
  'm2-exam-change': ['interest-rates', 'returns'],
  'm2-exam-bps': ['interest-rates'],
  'm2-exam-pv': ['present-value', 'discounting'],
  'm2-exam-fv': ['future-value', 'compounding'],
  'm2-exam-dcf': ['discounting'],
  'm2-exam-npv': ['npv'],
  'm2-exam-irr': ['irr'],
  'm3-exam-portfolio': ['portfolio-returns'],
  'm3-exam-net': ['returns'],
  'm3-exam-total': ['returns', 'stocks', 'dividends'],
  'm3-exam-coupon': ['bonds', 'dividends'],
  'm3-exam-concentration': ['diversification', 'risk-return'],
  'm3-exam-guarantee': ['risk-return'],
  'm3-exam-income': ['dividends', 'bonds'],
};

const byLesson: Record<string, CompetencyId[]> = {
  'm1-money': ['financial-literacy'],
  'm1-assets': ['financial-literacy'],
  'm1-income': ['financial-literacy'],
  'm1-budget': ['financial-literacy'],
  'm1-interest': ['compounding'],
  'm1-inflation': ['inflation'],
  'm2-percent': ['interest-rates'],
  'm2-bps': ['interest-rates'],
  'm2-pv': ['present-value'],
  'm2-fv': ['future-value'],
  'm2-dcf': ['discounting'],
  'm2-npv': ['npv'],
  'm3-securities': ['stocks', 'bonds'],
  'm3-total-return': ['returns'],
  'm3-net-return': ['returns'],
  'm3-income': ['dividends'],
  'm3-portfolio': ['portfolio-returns'],
  'm3-diversification': ['diversification'],
};

/** Explicit content metadata wins; legacy matching tests English, not every skill mentioned in the lesson. */
export function mapLegacyExercise(lessonId: string, exercise: Exercise): CompetencyId[] {
  const explicit = exercise.competencyIds?.filter(isCompetencyId);
  if (explicit?.length) return [...new Set(explicit)];
  if (exercise.kind === 'matching' || exercise.id.endsWith('-english'))
    return ['english-terminology'];
  if (exact[exercise.id]) return [...exact[exercise.id]];
  if (byLesson[lessonId]) return [...byLesson[lessonId]];
  return [];
}

export function difficultyForExercise(lessonId: string, exercise: Exercise): 1 | 2 | 3 {
  if (exercise.difficulty === 1 || exercise.difficulty === 2 || exercise.difficulty === 3)
    return exercise.difficulty;
  if (exercise.kind === 'matching') return 1;
  if (exercise.id === 'm3-diversification-practice' || exercise.id === 'm2-npv-scenario') return 3;
  if (lessonId.endsWith('-exam')) return 2;
  if (
    exercise.kind === 'scenario' ||
    exercise.kind === 'ordering' ||
    exercise.kind === 'calculation'
  )
    return 2;
  if (
    exercise.kind === 'numeric' &&
    /^(m2-(?:pv|fv|dcf|npv)|m3-(?:portfolio|net-return|total-return))/.test(lessonId)
  )
    return 2;
  if (exercise.id === 'm2-npv-irr-unique') return 2;
  return 1;
}
