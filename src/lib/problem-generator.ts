import { futureValue, irr, npv, presentValue } from './finance';
import { money, number, percent } from './format';
import type { CompetencyId, ExerciseEntry } from './learning-types';
import type { NumericExercise, SkillId, Unit } from './types';

type Difficulty = 1 | 2 | 3;
export type ProblemTemplateId =
  | 'future-value'
  | 'present-value'
  | 'simple-compound'
  | 'discount-two-flows'
  | 'total-return'
  | 'net-return'
  | 'real-return'
  | 'cagr'
  | 'portfolio-return'
  | 'basis-points'
  | 'npv'
  | 'irr'
  | 'coupon-yield'
  | 'drawdown';
type Template = {
  id: ProblemTemplateId;
  title: string;
  lessonId: string;
  competencyIds: CompetencyId[];
  difficulty: Difficulty;
};

/** Recommended levels are metadata; callers may request any of the three levels. */
export const problemTemplates: Template[] = [
  {
    id: 'future-value',
    title: 'Будущая стоимость капитала',
    lessonId: 'm2-fv',
    competencyIds: ['future-value', 'compounding'],
    difficulty: 1,
  },
  {
    id: 'present-value',
    title: 'Стоимость будущего платежа сегодня',
    lessonId: 'm2-pv',
    competencyIds: ['present-value', 'discounting'],
    difficulty: 1,
  },
  {
    id: 'simple-compound',
    title: 'Простые и сложные проценты',
    lessonId: 'm1-interest',
    competencyIds: ['interest-rates', 'compounding'],
    difficulty: 1,
  },
  {
    id: 'discount-two-flows',
    title: 'Два платежа на одной временной шкале',
    lessonId: 'm2-dcf',
    competencyIds: ['discounting', 'present-value'],
    difficulty: 2,
  },
  {
    id: 'total-return',
    title: 'Полный результат инвестиции',
    lessonId: 'm3-total-return',
    competencyIds: ['returns', 'dividends'],
    difficulty: 1,
  },
  {
    id: 'net-return',
    title: 'Доходность после расходов',
    lessonId: 'm3-net-return',
    competencyIds: ['returns'],
    difficulty: 2,
  },
  {
    id: 'real-return',
    title: 'Доходность в покупательной способности',
    lessonId: 'm1-inflation',
    competencyIds: ['inflation', 'returns'],
    difficulty: 2,
  },
  {
    id: 'cagr',
    title: 'Среднегодовой темп роста',
    lessonId: 'm2-fv',
    competencyIds: ['returns', 'compounding'],
    difficulty: 3,
  },
  {
    id: 'portfolio-return',
    title: 'Взвешенная доходность портфеля',
    lessonId: 'm3-portfolio',
    competencyIds: ['portfolio-returns'],
    difficulty: 2,
  },
  {
    id: 'basis-points',
    title: 'Изменение ставки в базисных пунктах',
    lessonId: 'm2-bps',
    competencyIds: ['interest-rates'],
    difficulty: 1,
  },
  {
    id: 'npv',
    title: 'Чистая приведённая стоимость проекта',
    lessonId: 'm2-npv',
    competencyIds: ['npv', 'discounting'],
    difficulty: 2,
  },
  {
    id: 'irr',
    title: 'Внутренняя норма доходности',
    lessonId: 'm2-npv',
    competencyIds: ['irr', 'discounting'],
    difficulty: 3,
  },
  {
    id: 'coupon-yield',
    title: 'Текущая доходность облигации',
    lessonId: 'm3-income',
    competencyIds: ['bonds', 'returns'],
    difficulty: 2,
  },
  {
    id: 'drawdown',
    title: 'Просадка от исторического пика',
    lessonId: 'm3-diversification',
    competencyIds: ['risk-return', 'returns'],
    difficulty: 2,
  },
];

/** Exposed for auditing a problem's assumptions independently of its solution. Rates are percent points. */
export type ProblemInputs = Readonly<Record<string, number | readonly number[]>>;

function getTemplate(templateId: string): Template {
  const template = problemTemplates.find((item) => item.id === templateId);
  if (!template) throw new RangeError('Неизвестный шаблон финансовой задачи.');
  return template;
}

function validateSeedAndDifficulty(
  seed: number,
  difficulty: number,
): asserts difficulty is Difficulty {
  if (!Number.isSafeInteger(seed))
    throw new RangeError('Seed должен быть конечным безопасным целым числом.');
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3)
    throw new RangeError('Сложность должна быть 1, 2 или 3.');
}

/** FNV-1a seeds a small deterministic PRNG; neither clock nor Math.random participates. */
function randomSource(templateId: string, seed: number, difficulty: Difficulty) {
  let state = 2166136261;
  const input = `finlab-bank-v1:${templateId}:${seed}:${difficulty}`;
  for (let index = 0; index < input.length; index += 1)
    state = Math.imul(state ^ input.charCodeAt(index), 16777619) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const integer = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(values: readonly T[]): T => values[integer(0, values.length - 1)];
  return { integer, pick };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getProblemInputs(
  templateId: string,
  seed: number,
  difficulty: Difficulty = 1,
): ProblemInputs {
  const template = getTemplate(templateId);
  validateSeedAndDifficulty(seed, difficulty);
  const { integer, pick } = randomSource(template.id, seed, difficulty);
  const initial = integer(5 + difficulty * 5, 30 + difficulty * 20) * 1000;
  const rate =
    difficulty === 1
      ? pick([5, 10])
      : difficulty === 2
        ? integer(3, 15)
        : pick([-12, -5, 3, 7, 12, 18]);
  const years = integer(difficulty, 2 + difficulty * 2);
  switch (template.id) {
    case 'future-value':
      return { initial, rate, years };
    case 'present-value':
      return { amount: initial, rate, years };
    case 'simple-compound':
      return { initial, rate: pick([4, 5, 6, 8, 10, 12]), years: integer(2, 2 + difficulty * 2) };
    case 'discount-two-flows':
      return {
        first: integer(10, 20 + difficulty * 20) * 1000,
        second: integer(10, 20 + difficulty * 20) * 1000,
        rate: integer(3, 5 + difficulty * 4),
      };
    case 'total-return': {
      const purchase = integer(10, 10 + difficulty * 40) * 10;
      return {
        purchase,
        sale: roundMoney(
          purchase * (1 + integer(-10 - difficulty * 5, 10 + difficulty * 10) / 100),
        ),
        distribution: integer(0, difficulty * 5) * 5,
      };
    }
    case 'net-return': {
      const ending = roundMoney(
        initial * (1 + integer(-5 - difficulty * 4, 5 + difficulty * 8) / 100),
      );
      const fee = integer(1, difficulty * 5) * 100;
      const tax = ending > initial ? roundMoney((ending - initial) * 0.1) : 0;
      return { initial, ending, fee, tax };
    }
    case 'real-return':
      return {
        nominal: integer(-5 - difficulty * 3, 5 + difficulty * 7),
        inflation: difficulty === 3 ? integer(-3, 15) : integer(1, 3 + difficulty * 4),
      };
    case 'cagr':
      return {
        initial,
        ending: roundMoney((initial * integer(40, 120 + difficulty * 30)) / 100),
        years: integer(2, 2 + difficulty * 2),
      };
    case 'portfolio-return':
      return {
        weightA: difficulty === 1 ? pick([25, 50, 75]) : integer(1, 19) * 5,
        returnA: integer(-5 - difficulty * 5, 10 + difficulty * 5),
        returnB: integer(-5 - difficulty * 5, 10 + difficulty * 5),
      };
    case 'basis-points': {
      const from = integer(8, 48) / 4;
      const change =
        difficulty === 3
          ? pick([-125, -80, -35, -5, 15, 40, 65, 110])
          : pick([-100, -75, -50, -25, 25, 50, 75, 100]);
      return { from, to: Math.round((from + change / 100) * 100) / 100 };
    }
    case 'npv':
      return {
        rate: integer(4, 8 + difficulty * 4),
        cashflows: [
          -initial,
          ...Array.from({ length: difficulty + 1 }, () => integer(10, 10 + difficulty * 30) * 1000),
        ],
      };
    case 'irr': {
      if (difficulty === 3)
        return { cashflows: [-initial, integer(10, 80) * 1000, integer(10, 100) * 1000] };
      const horizon = difficulty === 1 ? 1 : integer(2, 5);
      const annualRate = pick([-10, -5, 0, 5, 10, 15, 20]);
      return {
        cashflows: [
          -initial,
          ...Array.from({ length: horizon - 1 }, () => 0),
          roundMoney(initial * (1 + annualRate / 100) ** horizon),
        ],
      };
    }
    case 'coupon-yield': {
      const nominal = pick([1000, 2000, 5000]);
      const couponRate = integer(3, 5 + difficulty * 4);
      return {
        nominal,
        annualCoupon: (nominal * couponRate) / 100,
        price: (nominal * integer(80, 120)) / 100,
      };
    }
    case 'drawdown': {
      const peak = integer(10, 10 + difficulty * 30) * 1000;
      return { peak, trough: (peak * integer(40, 95)) / 100 };
    }
  }
}

type ProblemCopy = {
  prompt: string;
  hint: string;
  explanation: string;
  expected: number;
  unit: Unit;
};

function solveProblem(template: Template, inputs: ProblemInputs): ProblemCopy {
  const scalar = (key: string): number => {
    const value = inputs[key];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new RangeError('Некорректные исходные данные задачи.');
    return value;
  };
  const flows = () => inputs.cashflows as readonly number[];
  const r = (value: number) => `${number(value)}%`;
  switch (template.id) {
    case 'future-value': {
      const initial = scalar('initial'),
        rate = scalar('rate'),
        years = scalar('years');
      const expected = futureValue(initial, rate / 100, years);
      return {
        unit: 'currency',
        expected,
        prompt: `Учебный вклад: начальная сумма ${money(initial)}, эффективная ставка ${r(rate)} в год, срок ${years} г. Капитализация ежегодная; взносов и снятий нет. Какова будущая стоимость?`,
        hint: 'При ежегодной капитализации каждый следующий год работает и исходная сумма, и уже начисленный процент. Переведите процентную ставку в долю и возведите множитель роста в степень срока.',
        explanation: `1. Годовой множитель роста: 1 + ${number(rate)} / 100 = ${number(1 + rate / 100, 4)}. 2. FV = ${number(initial)} × (1 + ${number(rate)} / 100)^${years}. 3. Будущая стоимость равна ${money(expected)}. Промежуточные множители не округляем.`,
      };
    }
    case 'present-value': {
      const amount = scalar('amount'),
        rate = scalar('rate'),
        years = scalar('years');
      const expected = presentValue(amount, rate / 100, years);
      return {
        unit: 'currency',
        expected,
        prompt: `Через ${years} г. ожидается единственный платёж ${money(amount)}. Эффективная годовая ставка дисконтирования — ${r(rate)}. Определите стоимость этого платежа сегодня; промежуточных потоков нет.`,
        hint: 'Дисконтирование переносит будущий платёж к сегодняшней дате: разделите его на накопленный множитель (1 + r)ⁿ. При отрицательной ставке PV может превышать будущую сумму.',
        explanation: `1. Ставка в долях: ${number(rate)} / 100. 2. PV = ${number(amount)} / (1 + ${number(rate)} / 100)^${years}. 3. Сегодняшняя стоимость: ${money(expected)}. Годовая ставка согласована со сроком в годах.`,
      };
    }
    case 'simple-compound': {
      const initial = scalar('initial'),
        rate = scalar('rate'),
        years = scalar('years');
      const simple = initial * (1 + (rate / 100) * years),
        compound = futureValue(initial, rate / 100, years);
      const expected = compound - simple;
      return {
        unit: 'currency',
        expected,
        prompt: `Две учебные схемы для ${money(initial)} на ${years} г. под ${r(rate)} годовых: простые проценты без капитализации и сложные с ежегодной капитализацией. На сколько рублей итог сложной схемы выше? Взносов, налогов и комиссий нет.`,
        hint: 'Сначала посчитайте два итога отдельно: P(1 + rn) и P(1 + r)ⁿ. В ответе нужна разность итоговых сумм, а не вся сумма процентов.',
        explanation: `1. Простые проценты: ${number(initial)} × (1 + ${number(rate)} / 100 × ${years}) = ${money(simple)}. 2. Сложные: ${number(initial)} × (1 + ${number(rate)} / 100)^${years} = ${money(compound)}. 3. Разность до округления: ${money(expected)}.`,
      };
    }
    case 'discount-two-flows': {
      const first = scalar('first'),
        second = scalar('second'),
        rate = scalar('rate');
      const pv1 = presentValue(first, rate / 100, 1),
        pv2 = presentValue(second, rate / 100, 2),
        expected = pv1 + pv2;
      return {
        unit: 'currency',
        expected,
        prompt: `Учебный контракт выплатит ${money(first)} в конце первого года и ${money(second)} в конце второго. Ставка дисконтирования — ${r(rate)} в год. Найдите общую приведённую стоимость двух поступлений на дату 0. Начальное вложение здесь не задано.`,
        hint: 'Каждый поток нужно дисконтировать на его собственный срок. Только после приведения обоих потоков к дате 0 можно сложить их стоимости.',
        explanation: `1. PV первого платежа = ${number(first)} / (1 + ${number(rate)} / 100) = ${money(pv1)}. 2. PV второго = ${number(second)} / (1 + ${number(rate)} / 100)² = ${money(pv2)}. 3. Складываем неокруглённые PV: ${money(expected)}. Это PV поступлений, а не NPV проекта.`,
      };
    }
    case 'total-return': {
      const purchase = scalar('purchase'),
        sale = scalar('sale'),
        distribution = scalar('distribution');
      const expected = ((sale - purchase + distribution) / purchase) * 100;
      return {
        unit: 'percent',
        expected,
        prompt: `Учебная акция куплена за ${money(purchase)}, затем продана за ${money(sale)}. За тот же период получен дивиденд ${money(distribution)} на акцию; он не реинвестировался. Какова полная доходность (Total Return) за период до расходов?`,
        hint: 'Полный результат состоит из изменения цены и выплаченного дохода. Разделите их сумму на первоначальную цену покупки, а затем выразите результат в процентах.',
        explanation: `1. Изменение цены: ${number(sale)} − ${number(purchase)} = ${money(sale - purchase)}. 2. Добавляем дивиденд ${money(distribution)}. 3. Total Return = (${number(sale)} − ${number(purchase)} + ${number(distribution)}) / ${number(purchase)} × 100% = ${r(expected)}. Доходность может быть отрицательной.`,
      };
    }
    case 'net-return': {
      const initial = scalar('initial'),
        ending = scalar('ending'),
        fee = scalar('fee'),
        tax = scalar('tax');
      const expected = ((ending - initial - fee - tax) / initial) * 100;
      return {
        unit: 'percent',
        expected,
        prompt: `В учебную позицию вложено ${money(initial)}. Стоимость при закрытии до расходов — ${money(ending)}. Отдельно удержаны комиссии ${money(fee)} и налог ${money(tax)} (суммы уже заданы, налоговую ставку определять не нужно). Найдите Net Return относительно первоначального вложения.`,
        hint: 'Из денежного результата до расходов вычтите отдельно заданные комиссии и налог. База расчёта доходности — первоначальное вложение; начальный капитал не является прибылью.',
        explanation: `1. Результат до расходов: ${number(ending)} − ${number(initial)} = ${money(ending - initial)}. 2. Чистый результат: ${money(ending - initial - fee - tax)} после вычета ${money(fee)} комиссий и ${money(tax)} налога. 3. Net Return = (${number(ending)} − ${number(initial)} − ${number(fee)} − ${number(tax)}) / ${number(initial)} × 100% = ${r(expected)}. Это учебные удержания, не налоговая консультация.`,
      };
    }
    case 'real-return': {
      const nominal = scalar('nominal'),
        inflation = scalar('inflation');
      const expected = ((1 + nominal / 100) / (1 + inflation / 100) - 1) * 100;
      return {
        unit: 'percent',
        expected,
        prompt: `За один и тот же учебный год номинальная доходность составила ${r(nominal)}, изменение уровня цен — ${r(inflation)}. Определите точную реальную доходность по отношению к покупательной способности в начале года.`,
        hint: 'Сравните множитель роста капитала с множителем изменения цен: (1 + rном) / (1 + π) − 1. Простое вычитание ставок даёт только приближение.',
        explanation: `1. Множитель капитала: 1 + ${number(nominal)} / 100. 2. Множитель цен: 1 + ${number(inflation)} / 100. 3. rреал = [(1 + ${number(nominal)} / 100) / (1 + ${number(inflation)} / 100) − 1] × 100% = ${r(expected)}. Отрицательный результат означает снижение покупательной способности.`,
      };
    }
    case 'cagr': {
      const initial = scalar('initial'),
        ending = scalar('ending'),
        years = scalar('years');
      const expected = (Math.pow(ending / initial, 1 / years) - 1) * 100;
      return {
        unit: 'percent',
        expected,
        prompt: `Учебный капитал изменился с ${money(initial)} до ${money(ending)} за ${years} г. Промежуточных взносов, выводов и выплат не было. Какой постоянный среднегодовой сложный темп роста (CAGR) даёт тот же итог?`,
        hint: 'Нужен геометрический годовой множитель: извлеките корень степени числа лет из отношения конечной стоимости к начальной. Общую доходность нельзя просто разделить на число лет.',
        explanation: `1. Отношение конечного капитала к начальному: ${number(ending)} / ${number(initial)}. 2. Годовой множитель — (${number(ending)} / ${number(initial)})^(1 / ${years}). 3. CAGR = [(${number(ending)} / ${number(initial)})^(1 / ${years}) − 1] × 100% = ${r(expected)}. Это эквивалентный постоянный темп, а не описание каждого фактического года.`,
      };
    }
    case 'portfolio-return': {
      const weightA = scalar('weightA'),
        returnA = scalar('returnA'),
        returnB = scalar('returnB');
      const expected = (weightA / 100) * returnA + (1 - weightA / 100) * returnB;
      return {
        unit: 'percent',
        expected,
        prompt: `Начальные веса учебного портфеля: актив A — ${r(weightA)}, актив B — ${r(100 - weightA)}. За один период доходность A равна ${r(returnA)}, B — ${r(returnB)}. Взносов, выводов и ребалансировки не было. Найдите доходность всего портфеля.`,
        hint: 'Умножьте доходность каждого актива на его начальную долю в портфеле. Сложите вклады; арифметическое среднее подходит только при равных весах.',
        explanation: `1. Доли: wA = ${number(weightA)} / 100 и wB = ${number(100 - weightA)} / 100; сумма равна 1. 2. Вклады в общую доходность: ${number((weightA / 100) * returnA)} п.п. и ${number((1 - weightA / 100) * returnB)} п.п. 3. Rₚ = ${number(weightA)} / 100 × ${r(returnA)} + ${number(100 - weightA)} / 100 × ${r(returnB)} = ${r(expected)}.`,
      };
    }
    case 'basis-points': {
      const from = scalar('from'),
        to = scalar('to'),
        expected = (to - from) * 100;
      return {
        unit: 'bps',
        expected,
        prompt: `Учебная процентная ставка изменилась с ${r(from)} до ${r(to)}. Выразите изменение в базисных пунктах со знаком: рост положительный, снижение отрицательное.`,
        hint: 'Сначала найдите разность ставок в процентных пунктах. Один процентный пункт равен 100 базисным пунктам; не делите эту разность на исходную ставку.',
        explanation: `1. Изменение в процентных пунктах: ${number(to)} − ${number(from)} = ${number(to - from)} п.п. 2. Один bp = 0,01 п.п. 3. Изменение = (${number(to)} − ${number(from)}) × 100 = ${number(expected)} bp. Знак показывает направление изменения.`,
      };
    }
    case 'npv': {
      const cashflows = flows(),
        rate = scalar('rate'),
        expected = npv([...cashflows], rate / 100);
      const timeline = cashflows
        .slice(1)
        .map((flow, index) => `год ${index + 1}: ${money(flow)}`)
        .join('; ');
      return {
        unit: 'currency',
        expected,
        prompt: `Учебный проект требует ${money(-cashflows[0])} сегодня (дата 0), затем приносит потоки в конце соответствующих лет: ${timeline}. Ставка дисконтирования — ${r(rate)} в год. Рассчитайте NPV; иных потоков нет.`,
        hint: 'Приведите каждый будущий поток к дате 0 и сложите результаты. Начальное вложение происходит уже сегодня: включите его со знаком минус без дисконтирования.',
        explanation: `1. Денежный поток на дате 0: ${money(cashflows[0])}. 2. PV поступлений = ${cashflows
          .slice(1)
          .map((flow, index) => `${number(flow)} / (1 + ${number(rate)} / 100)^${index + 1}`)
          .join(
            ' + ',
          )}. 3. NPV = ${number(cashflows[0])} + PV поступлений = ${money(expected)}. Положительный NPV соответствует превышению требуемой доходности в рамках заданных предположений.`,
      };
    }
    case 'irr': {
      const cashflows = flows(),
        expected = irr([...cashflows]) * 100;
      const timeline = cashflows
        .slice(1)
        .map((flow, index) => `год ${index + 1}: ${money(flow)}`)
        .join('; ');
      return {
        unit: 'percent',
        expected,
        prompt: `Обычный учебный инвестиционный поток: ${money(cashflows[0])} сегодня; ${timeline}. Все будущие поступления в конце года, промежуточные потоки явно указаны. Найдите годовую IRR — ставку, при которой NPV равна нулю. Можно использовать финансовый калькулятор.`,
        hint: 'IRR решает уравнение CF₀ + Σ CFₜ / (1 + r)ᵗ = 0. У данного потока одна смена знака, поэтому IRR единственна. Допустима и отрицательная IRR.',
        explanation: `1. Записываем −${number(-cashflows[0])} + ${cashflows
          .slice(1)
          .map((flow, index) => `${number(flow)} / (1 + r)^${index + 1}`)
          .join(
            ' + ',
          )} = 0. 2. Находим корень по r, например методом деления интервала пополам. 3. IRR = ${r(expected)} годовых; подстановка неокруглённой ставки даёт NPV ≈ 0. Это не гарантия реинвестирования промежуточных поступлений по IRR.`,
      };
    }
    case 'coupon-yield': {
      const nominal = scalar('nominal'),
        annualCoupon = scalar('annualCoupon'),
        price = scalar('price'),
        expected = (annualCoupon / price) * 100;
      return {
        unit: 'percent',
        expected,
        prompt: `Учебная облигация: номинал ${money(nominal)}, годовой денежный купон ${money(annualCoupon)}, текущая чистая цена ${money(price)}. Рассчитайте текущую купонную доходность (Current Yield); НКД и расходы для этой задачи не учитываются.`,
        hint: 'Current Yield — годовой денежный купон, делённый на текущую цену облигации. Купонная ставка использует другую базу — номинал. Текущая доходность не равна YTM.',
        explanation: `1. Годовой денежный купон уже задан: ${money(annualCoupon)}. 2. Делим его на текущую цену ${money(price)}, а не на номинал ${money(nominal)}. 3. Current Yield = ${number(annualCoupon)} / ${number(price)} × 100% = ${r(expected)}. Изменение цены к погашению и срок в этом показателе не учитываются.`,
      };
    }
    case 'drawdown': {
      const peak = scalar('peak'),
        trough = scalar('trough'),
        expected = ((peak - trough) / peak) * 100;
      return {
        unit: 'percent',
        expected,
        prompt: `Учебный портфель после пика ${money(peak)} снизился до ${money(trough)}; между этими датами взносов и выводов не было. Найдите величину просадки (Drawdown) от пика. Укажите её положительным числом в процентах.`,
        hint: 'Потерю стоимости делят на предыдущий пик. Не используйте текущую стоимость как базу: она понадобилась бы для расчёта роста, необходимого для восстановления.',
        explanation: `1. Снижение стоимости: ${number(peak)} − ${number(trough)} = ${money(peak - trough)}. 2. База — прежний пик ${money(peak)}. 3. Величина Drawdown = (${number(peak)} − ${number(trough)}) / ${number(peak)} × 100% = ${r(expected)}. В этой задаче запрошена положительная величина потери, а не доходность со знаком минус.`,
      };
    }
  }
}

export function generateProblem(
  templateId: string,
  seed: number,
  difficulty: Difficulty = 1,
): ExerciseEntry {
  const template = getTemplate(templateId);
  validateSeedAndDifficulty(seed, difficulty);
  const inputs = getProblemInputs(template.id, seed, difficulty);
  const copy = solveProblem(template, inputs);
  if (!Number.isFinite(copy.expected))
    throw new RangeError('Результат задачи должен быть конечным числом.');
  const competencyIds = [...template.competencyIds];
  const skills: SkillId[] = ['mathematics'];
  if (competencyIds.some((id) => ['returns', 'bonds', 'dividends', 'risk-return'].includes(id)))
    skills.push('investments');
  if (competencyIds.includes('portfolio-returns')) skills.push('portfolio');
  if (template.lessonId.startsWith('m1-')) skills.push('literacy');
  const suffix = `${template.id}:${Object.is(seed, -0) ? 0 : seed}:${difficulty}`;
  const exercise: NumericExercise = {
    id: `generated:${suffix}`,
    kind: 'numeric',
    templateId: template.id,
    variantId: `bank-v1:${suffix}`,
    seed: Object.is(seed, -0) ? 0 : seed,
    difficulty,
    competencyIds,
    skills,
    ...copy,
    instruction:
      copy.unit === 'currency'
        ? 'Ответ в рублях. Округлите итог до двух знаков; можно ввести 1 234,56 или 1 234,56 ₽. Все суммы и ставки — учебные предположения.'
        : copy.unit === 'bps'
          ? 'Ответ в базисных пунктах со знаком: например −25 или −25 bp. Не вводите знак %. Данные учебные.'
          : 'Ответ в процентах, не в долях: например 7,5 или 7,5%. Округлите только итог до двух знаков. Данные учебные.',
    ...(copy.unit === 'currency' ? { currency: 'RUB' as const } : {}),
    absoluteTolerance: 0.005,
    relativeTolerance: 0,
  };
  return { exercise, lessonId: template.lessonId, competencyIds: [...competencyIds], difficulty };
}
