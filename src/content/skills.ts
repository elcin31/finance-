import type { Competency, CompetencyGroup, CompetencyId } from '@/lib/learning-types';

export const competencyGroups: { id: CompetencyGroup; name: string; description: string }[] = [
  {
    id: 'fundamentals',
    name: 'Финансовая основа',
    description: 'Деньги, ставки, покупательная способность и результат вложений.',
  },
  {
    id: 'mathematics',
    name: 'Финансовая математика',
    description: 'Стоимость денег во времени и оценка денежных потоков.',
  },
  {
    id: 'investments',
    name: 'Инвестиции и портфель',
    description: 'Инструменты, денежные выплаты и распределение риска.',
  },
  {
    id: 'english',
    name: 'Financial English',
    description: 'Термины, чтение и объяснение финансовых расчётов на английском.',
  },
];

/** Stable, version-independent competency IDs. Prerequisites guide recommendations, never block public lessons. */
export const competencies: Competency[] = [
  {
    id: 'financial-literacy',
    name: 'Финансовая грамотность',
    english: 'Financial literacy',
    description:
      'Различать активы, обязательства, доходы и расходы; составлять личный баланс и бюджет.',
    group: 'fundamentals',
    lessonIds: ['m1-money', 'm1-assets', 'm1-income', 'm1-budget'],
    prerequisites: [],
  },
  {
    id: 'interest-rates',
    name: 'Проценты и ставки',
    english: 'Percentages and interest rates',
    description:
      'Считать относительные изменения и различать проценты, процентные пункты и базисные пункты.',
    group: 'fundamentals',
    lessonIds: ['m2-percent', 'm2-bps', 'm1-interest'],
    prerequisites: ['financial-literacy'],
  },
  {
    id: 'inflation',
    name: 'Инфляция',
    english: 'Inflation and purchasing power',
    description:
      'Связывать рост цен, номинальную доходность и изменение покупательной способности.',
    group: 'fundamentals',
    lessonIds: ['m1-inflation'],
    prerequisites: ['interest-rates'],
  },
  {
    id: 'returns',
    name: 'Доходность',
    english: 'Investment returns',
    description:
      'Различать прирост цены, полную, чистую и реальную доходность, согласовывать базу расчёта.',
    group: 'fundamentals',
    lessonIds: ['m3-total-return', 'm3-net-return', 'm2-percent'],
    prerequisites: ['interest-rates'],
  },
  {
    id: 'compounding',
    name: 'Сложный процент',
    english: 'Compounding',
    description:
      'Объяснять капитализацию и вычислять результат последовательного начисления процентов.',
    group: 'mathematics',
    lessonIds: ['m1-interest', 'm2-fv'],
    prerequisites: ['interest-rates'],
  },
  {
    id: 'present-value',
    name: 'Текущая стоимость',
    english: 'Present value',
    description:
      'Приводить будущий платёж к сегодняшней стоимости по согласованной ставке и сроку.',
    group: 'mathematics',
    lessonIds: ['m2-pv'],
    prerequisites: ['interest-rates'],
  },
  {
    id: 'future-value',
    name: 'Будущая стоимость',
    english: 'Future value',
    description: 'Рассчитывать будущую сумму капитала и различать начальные и конечные взносы.',
    group: 'mathematics',
    lessonIds: ['m2-fv', 'm1-interest'],
    prerequisites: ['compounding'],
  },
  {
    id: 'discounting',
    name: 'Дисконтирование',
    english: 'Discounted cash flows',
    description:
      'Приводить платежи разных дат к общей дате и корректно учитывать поток в момент t=0.',
    group: 'mathematics',
    lessonIds: ['m2-dcf', 'm2-pv'],
    prerequisites: ['present-value'],
  },
  {
    id: 'npv',
    name: 'Чистая приведённая стоимость',
    english: 'Net present value',
    description:
      'Вычислять NPV и интерпретировать создаваемую стоимость при заданной требуемой доходности.',
    group: 'mathematics',
    lessonIds: ['m2-npv', 'm2-dcf'],
    prerequisites: ['discounting'],
  },
  {
    id: 'irr',
    name: 'Внутренняя норма доходности',
    english: 'Internal rate of return',
    description:
      'Понимать IRR, условия существования единственного решения и ограничения сравнения проектов.',
    group: 'mathematics',
    lessonIds: ['m2-npv'],
    prerequisites: ['npv'],
  },
  {
    id: 'stocks',
    name: 'Акции',
    english: 'Stocks and ownership',
    description:
      'Различать долевое владение, права акционера, изменение цены и негарантированные выплаты.',
    group: 'investments',
    lessonIds: ['m3-securities', 'm3-income'],
    prerequisites: ['financial-literacy'],
  },
  {
    id: 'bonds',
    name: 'Облигации',
    english: 'Bonds and fixed income',
    description:
      'Различать номинал, цену, купон и доходность к погашению; объяснять процентный и кредитный риск.',
    group: 'investments',
    lessonIds: ['m3-securities', 'm3-income'],
    prerequisites: ['interest-rates'],
  },
  {
    id: 'dividends',
    name: 'Дивиденды и купоны',
    english: 'Dividends and coupon income',
    description:
      'Вычислять денежные выплаты и текущую доходность, не принимая исторические выплаты за гарантию.',
    group: 'investments',
    lessonIds: ['m3-income', 'm3-securities'],
    prerequisites: ['stocks', 'bonds'],
  },
  {
    id: 'portfolio-returns',
    name: 'Доходность портфеля',
    english: 'Portfolio returns',
    description:
      'Считать результат по начальным весам, учитывать деньги на счёте и проверять сумму весов.',
    group: 'investments',
    lessonIds: ['m3-portfolio'],
    prerequisites: ['returns', 'stocks', 'bonds'],
  },
  {
    id: 'diversification',
    name: 'Диверсификация',
    english: 'Diversification',
    description:
      'Различать число позиций и независимость факторов риска, применять базовую модель корреляции.',
    group: 'investments',
    lessonIds: ['m3-diversification', 'm3-portfolio'],
    prerequisites: ['portfolio-returns'],
  },
  {
    id: 'risk-return',
    name: 'Риск и доходность',
    english: 'Risk and return',
    description:
      'Отличать ожидаемый результат от гарантии, оценивать ограничения исторических рисковых показателей.',
    group: 'investments',
    lessonIds: ['m3-diversification', 'm3-securities'],
    prerequisites: ['diversification'],
  },
  {
    id: 'english-terminology',
    name: 'Финансовые термины',
    english: 'Financial terminology',
    description: 'Узнавать финансовые термины и выбирать точный перевод по контексту.',
    group: 'english',
    lessonIds: ['m1-money', 'm1-assets', 'm3-securities'],
    prerequisites: [],
  },
  {
    id: 'english-reading',
    name: 'Чтение финансовых текстов',
    english: 'Financial reading',
    description:
      'Извлекать смысл из кратких финансовых объяснений, отчётов и описаний инструментов.',
    group: 'english',
    lessonIds: ['m3-total-return', 'm3-income'],
    prerequisites: ['english-terminology'],
  },
  {
    id: 'english-calculations',
    name: 'Расчёты на английском',
    english: 'Financial calculations in English',
    description: 'Выбирать формулу и выполнять финансовый расчёт по англоязычному условию.',
    group: 'english',
    lessonIds: ['m2-percent', 'm2-pv', 'm3-portfolio'],
    prerequisites: ['english-terminology', 'interest-rates'],
  },
  {
    id: 'english-expressions',
    name: 'Профессиональные формулировки',
    english: 'Professional financial expressions',
    description:
      'Корректно описывать изменение показателей, денежные потоки и инвестиционные выводы.',
    group: 'english',
    lessonIds: ['m2-bps', 'm3-net-return'],
    prerequisites: ['english-reading'],
  },
];

const competencyMap = new Map(competencies.map((competency) => [competency.id, competency]));

export function getCompetency(id: CompetencyId): Competency;
export function getCompetency(id: string): Competency | undefined;
export function getCompetency(id: string): Competency | undefined {
  return competencyMap.get(id as CompetencyId);
}

export function isCompetencyId(value: string): value is CompetencyId {
  return competencyMap.has(value as CompetencyId);
}
