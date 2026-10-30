import type { CompetencyId, ExerciseEntry } from '@/lib/learning-types';
import type { Exercise, SkillId, Term, Unit } from '@/lib/types';

type Category = NonNullable<ExerciseEntry['category']>;
type Draft = Exercise extends infer E
  ? E extends Exercise
    ? Omit<E, 'skills' | 'competencyIds' | 'difficulty' | 'templateId' | 'variantId' | 'seed'>
    : never
  : never;
const competencyByCategory: Record<Category, CompetencyId> = {
  vocabulary: 'english-terminology',
  reading: 'english-reading',
  calculations: 'english-calculations',
  expressions: 'english-expressions',
};
function en(
  category: Category,
  lessonId: string,
  difficulty: 1 | 2 | 3,
  draft: Draft,
): ExerciseEntry {
  const competencyIds = [competencyByCategory[category]];
  const skills: SkillId[] = draft.kind === 'numeric' ? ['english', 'mathematics'] : ['english'];
  return {
    lessonId,
    category,
    competencyIds,
    difficulty,
    exercise: {
      ...draft,
      skills,
      competencyIds,
      difficulty,
      templateId: draft.id,
      variantId: `${draft.id}:v1`,
      seed: 0,
    } as Exercise,
  };
}
function c(
  id: string,
  prompt: string,
  labels: string[],
  answers: number | number[],
  hint: string,
  explanation: string,
  scenario = false,
): Draft {
  const correct = Array.isArray(answers) ? answers : [answers];
  return {
    id,
    kind: scenario ? 'scenario' : 'choice',
    prompt,
    options: labels.map((label, index) => ({ id: String(index), label })),
    correct: correct.map(String),
    multiple: Array.isArray(answers),
    hint,
    explanation,
    instruction: Array.isArray(answers)
      ? 'Прочитайте финансовый контекст и выберите все верные ответы.'
      : 'Прочитайте финансовый контекст на английском и выберите один ответ.',
  };
}
function n(
  id: string,
  prompt: string,
  expected: number,
  unit: Unit,
  hint: string,
  explanation: string,
): Draft {
  return {
    id,
    kind: 'numeric',
    prompt,
    expected,
    unit,
    ...(unit === 'currency' ? { currency: 'USD' as const } : {}),
    absoluteTolerance: 0.005,
    hint,
    explanation,
    instruction:
      unit === 'currency'
        ? 'Рассчитайте ответ по английскому условию. Введите доллары США, не рубли; округлите до центов.'
        : unit === 'percent'
          ? 'Рассчитайте ответ по английскому условию. Введите число процентов, например 7,5; округлите до сотых.'
          : 'Рассчитайте показатель по английскому условию. Ответ — безразмерное число, округлённое до сотых.',
  };
}
function b(id: string, prompt: string, correct: boolean, hint: string, explanation: string): Draft {
  return {
    id,
    kind: 'boolean',
    prompt,
    correct,
    hint,
    explanation,
    instruction: 'Определите, верно ли английское утверждение в данном финансовом контексте.',
  };
}
function m(
  id: string,
  prompt: string,
  pairs: [string, string][],
  hint: string,
  explanation: string,
): Draft {
  return {
    id,
    kind: 'matching',
    prompt,
    pairs: pairs.map(([left, right], index) => ({ id: String(index), left, right })),
    hint,
    explanation,
    instruction: 'Сопоставьте английские термины с точным финансовым смыслом.',
  };
}
function o(id: string, prompt: string, labels: string[], hint: string, explanation: string): Draft {
  return {
    id,
    kind: 'ordering',
    prompt,
    items: labels.map((label, index) => ({ id: String(index), label })),
    correctOrder: labels.map((_, index) => String(index)),
    hint,
    explanation,
    instruction: 'Расположите этапы аналитического объяснения в логическом порядке.',
  };
}

export const englishTracks: { id: Category; title: string; description: string }[] = [
  {
    id: 'vocabulary',
    title: 'Финансовые термины',
    description:
      'Точный смысл терминов баланса, доходности, оценки и риска в профессиональном контексте.',
  },
  {
    id: 'reading',
    title: 'Чтение аналитики',
    description:
      'Короткие оригинальные отчёты на английском: отделяйте факты, предположения и обоснованные выводы.',
  },
  {
    id: 'calculations',
    title: 'Расчёты на английском',
    description:
      'EPS, капитализация, доходность, дисконтирование и риск: прочитайте условие и рассчитайте показатель.',
  },
  {
    id: 'expressions',
    title: 'Язык аналитика',
    description:
      'Net of fees, all else equal, year over year и другие выражения, необходимые для точного объяснения решения.',
  },
];

export type ProfessionalTerm = Term & { exerciseId: string };

/** Reference cards teach the concepts before practice without disclosing an exercise's answer. */
export const professionalTerms: ProfessionalTerm[] = [
  {
    en: 'Net Return',
    ru: 'Чистая доходность',
    definition:
      'Результат после конкретно указанных расходов. Уточняйте, включены ли комиссии покупки, продажи, управления и личные налоги. При одном вложении чистую прибыль относят ко всем первоначальным денежным затратам.',
    context: 'The report is net of management fees but before investors’ personal taxes.',
    lessonId: 'm3-net-return',
    exerciseId: 'en02-e-net-of-fees',
  },
  {
    en: 'Gross Return',
    ru: 'Валовая доходность',
    definition:
      'Доходность до вычета оговорённых комиссий, налогов или иных расходов. Состав исключённых расходов должен быть раскрыт; слово gross без контекста не задаёт универсальную методику.',
    context: 'Compare gross return with net return only after checking which costs are excluded.',
    lessonId: 'm3-total-return',
    exerciseId: 'en02-v-return-measures',
  },
  {
    en: 'Weighted Average',
    ru: 'Средневзвешенное значение',
    definition:
      'Сумма произведений значений на соответствующие веса. Веса должны иметь согласованную базу и в обычной средней составлять 100%. Для простой доходности портфеля используют начальные веса и общий период.',
    context: 'The weighted average return reflects the initial capital allocated to each asset.',
    lessonId: 'm3-portfolio',
    exerciseId: 'en02-c-weighted-average',
  },
  {
    en: 'Discount Rate',
    ru: 'Ставка дисконтирования',
    definition:
      'Ставка для приведения будущих денежных потоков к выбранной дате. Её период, валюта, номинальный или реальный характер и риск должны соответствовать оцениваемым потокам.',
    context:
      'A higher discount rate lowers the present value of a fixed positive payment, all else equal.',
    lessonId: 'm2-pv',
    exerciseId: 'en02-v-time-value',
  },
  {
    en: 'Cash Flow',
    ru: 'Денежный поток',
    definition:
      'Поступление или выплата денег с указанием суммы и даты. Знак определяется единой точкой зрения: для инвестора вложение обычно отрицательно, полученная выплата положительна. Бухгалтерская прибыль не равна денежному потоку.',
    context: 'The valuation discounts each forecast cash flow to the same date.',
    lessonId: 'm2-npv',
    exerciseId: 'en02-r-npv-assumptions',
  },
  {
    en: 'Portfolio Allocation',
    ru: 'Распределение портфеля',
    definition:
      'Распределение капитала между позициями или группами активов. Доли включают денежный остаток и задаются на определённую дату; целевые доли могут отличаться от текущих после изменения цен.',
    context: 'Portfolio allocation includes both invested assets and the cash position.',
    lessonId: 'm3-portfolio',
    exerciseId: 'en02-r-portfolio-cash',
  },
  {
    en: 'EPS',
    ru: 'Прибыль на акцию',
    definition:
      'Earnings per share. Basic EPS = прибыль, доступная обыкновенным акционерам, / средневзвешенное число обыкновенных акций за период. Из общей прибыли при необходимости вычитают дивиденды привилегированных акций. Единица — валюта на акцию, например USD/share. EPS не равна дивиденду; diluted EPS учитывает потенциальное разводнение по отдельным правилам.',
    context:
      'Basic EPS fell because the weighted-average common share count increased while positive earnings were unchanged.',
    lessonId: 'm3-securities',
    exerciseId: 'en02-c-eps',
  },
  {
    en: 'Market Capitalization',
    ru: 'Рыночная капитализация',
    definition:
      'Для одного класса обыкновенных акций: рыночная цена одной акции × число таких акций в обращении. Единица — валюта, например USD, а не USD/share. Используют outstanding shares, не только свободно обращающуюся долю free float. Это стоимость собственного капитала на рынке, а не выручка и не enterprise value.',
    context:
      'Common equity market capitalization equals the share price multiplied by common shares outstanding.',
    lessonId: 'm3-securities',
    exerciseId: 'en02-c-market-cap',
  },
  {
    en: 'Risk-adjusted Return',
    ru: 'Доходность с учётом риска',
    definition:
      'Оценка результата относительно явно названной меры или модели риска. Сравнение требует согласованных периодов, данных и предположений. Высокая оценка по одной мере не гарантирует будущего результата и не означает отсутствия других рисков.',
    context:
      'Risk-adjusted return should be interpreted together with liquidity and downside-risk analysis.',
    lessonId: 'm3-diversification',
    exerciseId: 'en02-v-risk-adjusted',
  },
  {
    en: 'Revenue',
    ru: 'Выручка',
    definition:
      'Доход от продажи товаров или услуг до вычета соответствующих расходов. Рост выручки сам по себе не доказывает рост прибыли, денежного потока или рентабельности.',
    context: 'Revenue increased, but operating earnings did not keep pace with sales.',
    lessonId: 'm1-income',
    exerciseId: 'en02-r-margin',
  },
  {
    en: 'Earnings',
    ru: 'Прибыль',
    definition:
      'Финансовый результат после соответствующих расходов. Нужно уточнять уровень показателя: operating earnings, net earnings или прибыль, доступная обыкновенным акционерам. Значения разных уровней не взаимозаменяемы.',
    context: 'The analyst distinguishes revenue, operating earnings and earnings per share.',
    lessonId: 'm1-income',
    exerciseId: 'en02-v-earnings',
  },
  {
    en: 'Asset',
    ru: 'Актив',
    definition:
      'Контролируемый ресурс с экономической ценностью. В личном балансе это, например, деньги, вклад или имущество. Актив может не приносить текущего денежного дохода; его стоимость не обязательно полностью доступна немедленно.',
    context: 'The balance sheet records the asset separately from the debt used to finance it.',
    lessonId: 'm1-assets',
    exerciseId: 'en02-v-balance',
  },
  {
    en: 'Liability',
    ru: 'Обязательство',
    definition:
      'Существующая обязанность передать экономические ресурсы, например вернуть кредит. Получение займа одновременно увеличивает деньги и обязательство; оно не создаёт заработанного дохода само по себе.',
    context: 'Receiving a loan increases cash and liabilities by the same amount before fees.',
    lessonId: 'm1-assets',
    exerciseId: 'en02-r-loan-balance',
  },
  {
    en: 'Equity',
    ru: 'Капитал',
    definition:
      'Остаточная доля в активах после вычета обязательств. В балансе equity = assets − liabilities. Рыночная оценка собственного капитала может отличаться от его бухгалтерского значения.',
    context: 'Book equity is not necessarily equal to market capitalization.',
    lessonId: 'm1-assets',
    exerciseId: 'en02-v-balance',
  },
  {
    en: 'Capital Gain',
    ru: 'Прирост капитала',
    definition:
      'Положительное изменение стоимости актива относительно стоимости приобретения. До продажи результат нереализован. Денежные дивиденды учитывают отдельно при расчёте полной доходности.',
    context: 'A capital gain and a cash dividend are different components of total return.',
    lessonId: 'm3-total-return',
    exerciseId: 'en02-v-return-measures',
  },
  {
    en: 'Total Return',
    ru: 'Полная доходность',
    definition:
      'Результат изменения стоимости и денежных выплат относительно начального вложения за один период. При реинвестировании выплат нужно избегать их двойного учёта в конечной стоимости и отдельной сумме дивидендов.',
    context:
      'Total return includes both the price change and cash distributions over the holding period.',
    lessonId: 'm3-total-return',
    exerciseId: 'en02-c-total-return',
  },
  {
    en: 'Coupon',
    ru: 'Купон',
    definition:
      'Процентная выплата по облигации согласно условиям выпуска. Годовая купонная ставка обычно применяется к номиналу; для отдельной выплаты проверяют частоту, календарь и конвенцию начисления.',
    context: 'The fixed coupon is based on face value rather than the investor’s purchase price.',
    lessonId: 'm3-income',
    exerciseId: 'en02-v-bond-income',
  },
  {
    en: 'Current Yield',
    ru: 'Текущая купонная доходность',
    definition:
      'Отношение годовой купонной выплаты к текущей цене облигации. Не включает ценовой результат до погашения и не равна автоматически yield to maturity. Для реальной сделки уточняют цену с учётом применимых начислений.',
    context: 'Current yield alone does not describe the complete return to maturity.',
    lessonId: 'm3-income',
    exerciseId: 'en02-c-current-yield',
  },
  {
    en: 'Sharpe Ratio',
    ru: 'Коэффициент Шарпа',
    definition:
      'В упрощённой согласованной оценке: (доходность портфеля − безрисковая ставка) / волатильность. Все показатели относятся к одному периоду; отношение безразмерно. Sharpe измеряет результат на единицу общей волатильности, но не полностью отражает хвостовые риски, ликвидность или просадку и зависит от выборки.',
    context: 'A higher historical Sharpe ratio does not guarantee future outperformance.',
    lessonId: 'm3-diversification',
    exerciseId: 'en02-c-sharpe',
  },
  {
    en: 'Diversification',
    ru: 'Диверсификация',
    definition:
      'Распределение капитала между различными источниками риска. Может уменьшать специфические риски и колебания сочетания, но не устраняет общий рыночный риск и не гарантирует прибыль. Исторические корреляции могут меняться.',
    context: 'Diversification benefits can weaken when common stress exposures dominate.',
    lessonId: 'm3-diversification',
    exerciseId: 'en02-r-correlation',
  },
];

/** Forty original tasks: ten in each track. USD amounts are fictional teaching inputs. */
export const englishPractice: ExerciseEntry[] = [
  en(
    'vocabulary',
    'm1-assets',
    1,
    m(
      'en02-v-balance',
      'A personal balance sheet separates resources, debts and the residual interest. Match each term to its meaning.',
      [
        ['Asset', 'Ресурс с экономической ценностью'],
        ['Liability', 'Существующее долговое обязательство'],
        ['Equity', 'Остаток активов после вычета обязательств'],
      ],
      'Восстановите структуру балансового равенства: ресурсы, требования кредиторов и собственная остаточная доля.',
      'Asset — актив, liability — обязательство, equity — капитал. Связь: Assets − Liabilities = Equity. Equity в данном контексте — остаточная величина, а не сумма денежных поступлений.',
    ),
  ),
  en(
    'vocabulary',
    'm1-income',
    1,
    m(
      'en02-v-earnings',
      'An analyst distinguishes sales, profit and profit per share. Match the terms.',
      [
        ['Revenue', 'Выручка до вычета соответствующих расходов'],
        ['Earnings', 'Прибыль после соответствующих расходов'],
        ['Earnings per share', 'Прибыль, относящаяся к одной обыкновенной акции'],
      ],
      'Определите, вычтены ли расходы и распределён ли результат по числу акций.',
      'Revenue — выручка, earnings — прибыль, earnings per share (EPS) — прибыль на акцию. Для basic EPS используют прибыль обыкновенных акционеров и средневзвешенное число обыкновенных акций.',
    ),
  ),
  en(
    'vocabulary',
    'm3-securities',
    1,
    c(
      'en02-v-market-cap',
      'Which definition best describes the market capitalization of a company with one class of common shares?',
      [
        'The market price per share multiplied by common shares outstanding',
        'Annual revenue minus annual expenses',
        'The company’s cash balance plus its total debt',
      ],
      0,
      'Посмотрите, оценивается ли рыночная стоимость собственного капитала или результат за период.',
      'Market capitalization = цена одной обыкновенной акции × число таких акций в обращении. Это стоимость собственного капитала на рынке, а не выручка, денежный остаток или enterprise value.',
    ),
  ),
  en(
    'vocabulary',
    'm3-income',
    1,
    m(
      'en02-v-bond-income',
      'Match the bond terms used in an income report.',
      [
        ['Coupon', 'Процентная выплата по условиям облигации'],
        ['Face value', 'Номинальная сумма по условиям выпуска'],
        ['Current yield', 'Годовой купон относительно текущей цены'],
      ],
      'Различайте денежную выплату, договорную базу и относительный показатель на рыночную цену.',
      'Coupon — купон; face value — номинал; current yield — текущая купонная доходность. Купонную ставку обычно считают от номинала, а current yield — от рыночной цены.',
    ),
  ),
  en(
    'vocabulary',
    'm3-total-return',
    2,
    c(
      'en02-v-return-measures',
      'Which statements use return terminology correctly?',
      [
        'Total return includes price changes and cash distributions',
        'Net return specifies a result after the stated costs',
        'Capital gain always includes cash dividends',
        'Gross return is necessarily after every investor’s personal taxes',
      ],
      [0, 1],
      'Проверьте отдельно состав результата и учёт расходов; эти характеристики не взаимозаменяемы.',
      'Total return включает изменение цены и выплаты. Net return означает результат после оговорённых расходов; нужно уточнять их состав. Capital gain относится к ценовому результату, а gross return не означает результат после личных налогов.',
    ),
  ),
  en(
    'vocabulary',
    'm3-diversification',
    1,
    b(
      'en02-v-drawdown',
      'Volatility and drawdown are two names for exactly the same risk statistic.',
      false,
      'Один показатель описывает разброс доходностей, другой — падение от предыдущего максимума.',
      'Volatility — стандартное отклонение доходностей за определённый период. Drawdown — снижение стоимости от предшествующего пика. Они характеризуют разные свойства пути стоимости и не равны по определению.',
    ),
  ),
  en(
    'vocabulary',
    'm3-diversification',
    2,
    c(
      'en02-v-risk-adjusted',
      'What does “risk-adjusted return” generally mean?',
      [
        'A return evaluated relative to a specified risk measure or model',
        'A guaranteed return with all risks removed',
        'The highest nominal return in the sample',
      ],
      0,
      'Обратите внимание: adjusted требует явно назвать, по какой мере или модели оценивается риск.',
      'Risk-adjusted return — результат с учётом выбранной меры или модели риска. Например, Sharpe ratio сопоставляет превышение над безрисковой ставкой с общей волатильностью. Никакая такая формулировка сама по себе не означает гарантированную прибыль.',
    ),
  ),
  en(
    'vocabulary',
    'm2-pv',
    1,
    m(
      'en02-v-time-value',
      'Match the valuation terms to the relevant date or role.',
      [
        ['Present value', 'Стоимость будущего потока на текущую дату'],
        ['Future value', 'Сумма на выбранную будущую дату'],
        ['Discount rate', 'Ставка приведения будущего потока к текущей дате'],
      ],
      'Определите, что является результатом на дату, а что — параметром преобразования между датами.',
      'Present value (PV) — текущая стоимость, future value (FV) — будущая стоимость, discount rate — ставка дисконтирования. PV = FV/(1+r)^n при согласованных периодах.',
    ),
  ),
  en(
    'vocabulary',
    'm3-portfolio',
    1,
    c(
      'en02-v-weighted-average',
      'A portfolio report uses a weighted average return. What determines each asset’s contribution in a simple single-period model without external flows?',
      [
        'Its initial portfolio weight and its return over the same period',
        'Its ticker length and listing date',
        'Only the highest asset return',
      ],
      0,
      'Термин weighted указывает, что позиции могут иметь неодинаковую долю капитала.',
      'Weighted average — средневзвешенное значение. В простой модели Rₚ = ΣwᵢRᵢ; wᵢ — начальный вес, Rᵢ — доходность актива за общий период. Обычное арифметическое среднее подходит только при равных весах.',
    ),
  ),
  en(
    'vocabulary',
    'm3-diversification',
    2,
    c(
      'en02-v-diversification',
      'An investor owns many securities that all depend on one commodity. Which term best describes the remaining issue?',
      ['Factor concentration', 'Guaranteed diversification', 'A risk-free portfolio'],
      0,
      'Разные названия могут повторять одну экономическую зависимость.',
      'Factor concentration — концентрация на общем факторе. Количество бумаг не гарантирует диверсификацию источников риска: все позиции могут зависеть от одной цены сырья.',
      true,
    ),
  ),

  en(
    'reading',
    'm1-assets',
    1,
    c(
      'en02-r-loan-balance',
      'Analyst note: “The household received a $5,000 loan. The proceeds remain in its bank account. There were no fees and no asset revaluations. Both the cash balance and outstanding debt increased.” Which conclusion follows immediately?',
      [
        'Net worth increased by $5,000',
        'Net worth was unchanged by receiving the loan',
        'The loan created earned income',
      ],
      1,
      'Отразите одно событие по обеим сторонам баланса; поступление само по себе не означает заработок.',
      'Получение займа увеличило активы и обязательства на одну сумму. ΔNet worth = +5 000 − 5 000 = 0 долларов. Proceeds здесь означает поступившие средства, а не заработанную прибыль.',
    ),
  ),
  en(
    'reading',
    'm1-income',
    2,
    c(
      'en02-r-margin',
      'Earnings brief: “Annual revenue rose from $100 million to $110 million. Operating earnings remained at $10 million. No accounting-policy change affected the comparison.” Which interpretation is supported?',
      [
        'Operating margin increased',
        'Operating margin decreased because earnings did not keep pace with revenue',
        'Revenue and earnings are identical measures',
      ],
      1,
      'Margin — отношение результата к выручке; сравните движение числителя и знаменателя.',
      'Operating margin снизилась с 10/100 = 10% до 10/110 ≈ 9,09%. Выручка выросла, но операционная прибыль не увеличилась. Revenue и operating earnings — разные показатели.',
    ),
  ),
  en(
    'reading',
    'm3-securities',
    2,
    c(
      'en02-r-eps',
      'Equity update: “Positive profit attributable to common shareholders was unchanged. The weighted-average number of common shares increased following a new issue. No preferred dividends or other adjustments changed.” What happens to basic EPS, all else equal?',
      ['It decreases', 'It must increase', 'It necessarily equals the share price'],
      0,
      'Проверьте влияние нового выпуска на знаменатель расчёта прибыли на акцию.',
      'Basic EPS = прибыль обыкновенных акционеров / средневзвешенное число обыкновенных акций. При неизменной положительной прибыли большее число акций уменьшает EPS. Отсюда не следует конкретное изменение рыночной цены.',
    ),
  ),
  en(
    'reading',
    'm3-securities',
    2,
    c(
      'en02-r-fixed-bond',
      'Bond desk note: “The bond’s scheduled fixed payments have not changed. Market-required yields for comparable risk have risen. The issuer’s credit outlook is unchanged.” Which price response is consistent with discounted cash-flow valuation?',
      [
        'A lower price, all else equal',
        'A higher price solely because the discount rate is higher',
        'A price that must always equal face value',
      ],
      0,
      'Платежи фиксированы; изменилась ставка, по которой рынок оценивает их текущую стоимость.',
      'При прежних положительных потоках более высокая ставка уменьшает их PV. Поэтому цена фиксированной облигации при прочих равных снижается; номинал не фиксирует текущую рыночную цену.',
    ),
  ),
  en(
    'reading',
    'm2-npv',
    3,
    c(
      'en02-r-npv-assumptions',
      'Investment memo: “The project has a positive NPV at the selected required return. The result relies on forecast cash flows and assumes the proposed costs are complete. A sensitivity analysis shows a lower value if sales disappoint.” Which conclusions are justified?',
      [
        'The base-case model creates value above the required return',
        'Actual profits are guaranteed',
        'Forecast and cost assumptions remain material to the decision',
        'Positive NPV eliminates the need to assess downside scenarios',
      ],
      [0, 2],
      'Слова forecast, assumes и sensitivity обозначают условия модели, а не подтверждённые будущие факты.',
      'Положительная NPV означает создание стоимости в рамках исходного сценария. Прогнозы потоков и полнота расходов существенны; снижение продаж может изменить вывод. Гарантия фактической прибыли и отсутствие необходимости сценарного анализа из текста не следуют.',
    ),
  ),
  en(
    'reading',
    'm1-inflation',
    2,
    b(
      'en02-r-real-return',
      'Research note: “The investment earned 8% net of fees over the year. The relevant consumer-price index rose by 5% over the same year.” Statement: “The investment’s purchasing power increased, although the exact real return is below 3%.”',
      true,
      'Для точного реального результата сравните коэффициенты роста, а не только разность ставок.',
      'Реальная доходность = (1,08/1,05 − 1)×100 ≈ 2,86%. Покупательная способность выросла, а результат ниже арифметической разности 3%. Net of fees сообщает об учёте комиссий, но само по себе не уточняет личные налоги.',
    ),
  ),
  en(
    'reading',
    'm3-portfolio',
    2,
    c(
      'en02-r-portfolio-cash',
      'Portfolio review: “At the start of the period, 70% was invested in shares and 30% was held in a non-interest-bearing cash account. There were no contributions or withdrawals. Share returns were positive.” What is required when reporting the whole portfolio’s return?',
      [
        'Exclude cash and report the share return as the portfolio return',
        'Include the initial 30% cash weight with a zero return',
        'Treat the cash balance as a positive investment profit',
      ],
      1,
      'Whole portfolio охватывает весь исходный капитал, включая позиции без дохода.',
      'Денежный остаток входит в портфель с весом 30% и доходностью 0%. Общий результат равен 0,70×Rshares + 0,30×0. Исключение денег завысило бы заявленную доходность всего капитала при положительном результате акций.',
    ),
  ),
  en(
    'reading',
    'm3-diversification',
    3,
    c(
      'en02-r-correlation',
      'Risk report: “Historical correlations were low in ordinary periods. During the stress sample, several assets declined together. The committee therefore tested a higher-correlation scenario.” Which interpretation is most accurate?',
      [
        'Historical correlations are permanently fixed',
        'Diversification benefits can weaken when common stress exposures dominate',
        'Holding several assets makes joint losses impossible',
      ],
      1,
      'Обратите внимание на различие ordinary periods и stress sample.',
      'Связи доходностей могут меняться. Усиление совместных падений уменьшает защиту от сочетания позиций при прочих равных. Поэтому стрессовые зависимости анализируют отдельно; число активов не делает совместные убытки невозможными.',
    ),
  ),
  en(
    'reading',
    'm3-net-return',
    2,
    c(
      'en02-r-net-of-fees',
      'Fund disclosure: “Reported performance is net of the management fee and before investors’ personal taxes. Brokerage costs paid directly by the investor are not included.” Which adjustments are appropriate for an investor’s own net result?',
      [
        'Subtract the management fee again',
        'Include applicable personal taxes not already reflected',
        'Include separately paid brokerage costs not already reflected',
        'Assume the published figure is after every possible expense',
      ],
      [1, 2],
      'Состав опубликованного net показателя ограничен прямо указанными расходами.',
      'Плату за управление повторно не вычитают: она уже отражена. Для личного результата нужно учесть применимые личные налоги и отдельно понесённые брокерские расходы, которые не включены в отчёт.',
    ),
  ),
  en(
    'reading',
    'm3-diversification',
    3,
    c(
      'en02-r-sharpe-limits',
      'Manager review: “Strategy A had a higher historical Sharpe ratio than Strategy B over the same sample using the same risk-free rate. Liquidity, drawdown and tail-risk analysis were reported separately.” What can be concluded?',
      [
        'A had a higher sample excess-return-to-volatility ratio',
        'A is guaranteed to outperform next year',
        'A necessarily has no tail risk',
      ],
      0,
      'Слово historical ограничивает вывод выборкой; Sharpe использует конкретную меру риска.',
      'Более высокий исторический Sharpe означает большее отношение избыточной доходности к волатильности в данной выборке. Он не гарантирует будущего превосходства и не описывает полностью ликвидность, просадки и хвостовые риски.',
    ),
  ),

  en(
    'calculations',
    'm3-securities',
    2,
    n(
      'en02-c-eps',
      'A fictional company reports net income of $45 million. Preferred dividends are $5 million. The weighted-average number of common shares is 10 million. Calculate basic earnings per common share in USD.',
      4,
      'currency',
      'Из прибыли сначала выделите часть, доступную обыкновенным акционерам; затем разделите её на средневзвешенное число их акций.',
      'Basic EPS = (Net income − Preferred dividends)/Weighted-average common shares = (45 − 5)/10 = $4,00 на обыкновенную акцию. Единица — доллары на акцию, не миллионы долларов.',
    ),
  ),
  en(
    'calculations',
    'm3-securities',
    1,
    n(
      'en02-c-market-cap',
      'A fictional company has 3.2 million common shares outstanding and a market price of $25 per share. Calculate common equity market capitalization in USD, not in millions.',
      80000000,
      'currency',
      'Shares outstanding задаёт количество бумаг; цена относится к одной бумаге. Учтите множитель million.',
      'Market capitalization = 3 200 000 × $25 = $80 000 000. Рыночная капитализация измеряет стоимость обыкновенного капитала по текущей цене, а не прибыль компании.',
    ),
  ),
  en(
    'calculations',
    'm3-total-return',
    1,
    n(
      'en02-c-total-return',
      'An investor buys one share for $50, sells it for $54, and receives a $1 cash dividend during the holding period. There are no fees or taxes and no reinvestment. Calculate total return as a percentage.',
      10,
      'percent',
      'Holding-period total return включает и изменение цены, и распределённые деньги.',
      'Total return = ($54 − $50 + $1)/$50 × 100 = 10%. Price return alone equals 8%; cash dividends contribute another 2 percentage points.',
    ),
  ),
  en(
    'calculations',
    'm3-net-return',
    2,
    n(
      'en02-c-net-return',
      'Total initial cash outlay, including all purchase costs, is $1,000. Net sale proceeds are $1,070 and additional net cash distributions are $20. There are no other costs or external flows. Calculate net holding-period return as a percentage.',
      9,
      'percent',
      'Outlay уже включает расходы покупки, а proceeds и distributions указаны чистыми. Не вычитайте расходы повторно.',
      'Net return = ($1 070 + $20 − $1 000)/$1 000 × 100 = 9%. Чистая прибыль равна $90. Слово net относится к прямо заданному составу денежных потоков.',
    ),
  ),
  en(
    'calculations',
    'm3-portfolio',
    2,
    n(
      'en02-c-weighted-average',
      'A two-asset portfolio starts with a 40% weight in A and a 60% weight in B. Total returns over the same period are 12% and 3%, respectively. There are no external cash flows. Calculate the weighted-average portfolio return as a percentage.',
      6.6,
      'percent',
      'Используйте initial weights, а не обычное среднее двух процентов.',
      'Weighted-average return = 0,40×12% + 0,60×3% = 4,8% + 1,8% = 6,6%. Сумма весов равна 100%, периоды доходностей совпадают.',
    ),
  ),
  en(
    'calculations',
    'm3-income',
    2,
    n(
      'en02-c-current-yield',
      'A fictional bond pays an annual coupon of $60 and trades at $960. Ignore accrued interest and costs in this exercise. Calculate current yield as a percentage.',
      6.25,
      'percent',
      'Current yield использует годовую выплату и текущую цену, а не доходность полного графика до погашения.',
      'Current yield = $60/$960×100 = 6,25%. Без дат купонов и суммы погашения это не расчёт yield to maturity.',
    ),
  ),
  en(
    'calculations',
    'm2-fv',
    2,
    n(
      'en02-c-future-value',
      'An initial investment of $5,000 earns an effective annual rate of 8% for three years. All returns are reinvested. There are no additional contributions, fees or taxes. Calculate future value in USD.',
      6298.56,
      'currency',
      'Effective annual rate применяется к годовому коэффициенту роста; число years задаёт степень.',
      'FV = $5 000×(1,08)³ = $6 298,56. Principal — $5 000, investment growth — $1 298,56.',
    ),
  ),
  en(
    'calculations',
    'm2-pv',
    2,
    n(
      'en02-c-present-value',
      'A single cash payment of $1,210 will be received in two years. The effective annual discount rate is 10%. Calculate present value in USD.',
      1000,
      'currency',
      'Будущий платёж нужно привести к сегодняшней дате; discount означает деление на коэффициент роста.',
      'PV = $1 210/(1,10)² = $1 000. При заданной ставке $1 000 сегодня и $1 210 через два года эквивалентны по модели.',
    ),
  ),
  en(
    'calculations',
    'm1-inflation',
    2,
    n(
      'en02-c-real-return',
      'The investment’s nominal net return is 8% over one year. Inflation over that same year is 3%. Calculate the exact real return as a percentage.',
      4.854368932038833,
      'percent',
      'Точная поправка на inflation требует отношения двух коэффициентов, а не только разности процентов.',
      'Real return = (1,08/1,03 − 1)×100 ≈ 4,85%. Простая разность 8 − 3 = 5% — приближение; заданный nominal net return уже учитывает оговорённые расходы.',
    ),
  ),
  en(
    'calculations',
    'm3-diversification',
    3,
    n(
      'en02-c-sharpe',
      'For a fictional annual sample, portfolio return is 12%, the risk-free rate is 2%, and return volatility is 20%. Calculate the simplified Sharpe ratio as a dimensionless number, not a percentage.',
      0.5,
      'number',
      'Excess return — превышение над risk-free rate; все три ставки должны относиться к одному периоду.',
      'Sharpe ratio = (0,12 − 0,02)/0,20 = 0,50. Отношение безразмерно. Оно оценивает превышение доходности на единицу волатильности и не устраняет необходимость анализа других рисков.',
    ),
  ),

  en(
    'expressions',
    'm3-net-return',
    1,
    c(
      'en02-e-net-of-fees',
      'A report says “returns are net of fees, but before personal taxes.” What does this wording mean?',
      [
        'Fees are already deducted, while personal taxes are not',
        'Every possible fee and tax is excluded from the calculation',
        'Personal taxes are deducted twice',
      ],
      0,
      'Разберите отдельно net of и before; расходы в финансовом отчёте нужно читать буквально.',
      'Net of fees — после вычета указанных комиссий. Before personal taxes — до личных налогов. Из фразы не следует, что любые другие расходы автоматически учтены; их состав проверяют в раскрытии.',
    ),
  ),
  en(
    'expressions',
    'm3-diversification',
    1,
    c(
      'en02-e-subject-to-risk',
      'A factsheet states: “The investment is subject to market risk.” Which interpretation is appropriate?',
      [
        'Market value may fluctuate and losses are possible',
        'The principal is guaranteed by the wording',
        'Market risk applies only after a profit is realized',
      ],
      0,
      'Subject to обозначает подверженность условию или фактору, а не предоставление гарантии.',
      'Subject to market risk означает подверженность рыночным колебаниям и возможность убытка. Это не обещание защиты капитала и не условие, возникающее только после фиксации прибыли.',
      true,
    ),
  ),
  en(
    'expressions',
    'm3-securities',
    1,
    m(
      'en02-e-par-prices',
      'Match common bond-pricing expressions to their meaning relative to face value.',
      [
        ['At par', 'По номинальной стоимости'],
        ['At a premium', 'Выше номинальной стоимости'],
        ['At a discount', 'Ниже номинальной стоимости'],
      ],
      'Во всех трёх выражениях сравнивается рыночная цена с одним договорным ориентиром.',
      'At par — цена равна номиналу, at a premium — выше номинала, at a discount — ниже. Высокая или низкая цена относительно номинала сама по себе не характеризует привлекательность без анализа потоков и риска.',
    ),
  ),
  en(
    'expressions',
    'm1-income',
    1,
    c(
      'en02-e-year-over-year',
      'An earnings release says “revenue increased year over year in the third quarter.” Which comparison is intended?',
      [
        'Third-quarter revenue versus the third quarter of the previous year',
        'Third-quarter revenue versus the immediately preceding day',
        'Revenue versus the company’s market capitalization',
      ],
      0,
      'Year over year сопоставляет одинаковые календарные интервалы разных лет.',
      'Year over year (YoY) для квартального показателя означает сравнение этого квартала с тем же кварталом предыдущего года. Это отличается от quarter over quarter, где сравнивают с предыдущим кварталом.',
    ),
  ),
  en(
    'expressions',
    'm2-bps',
    1,
    b(
      'en02-e-bps-higher',
      '“The rate is 25 basis points higher than 2.00%” means that the new rate is 2.25%.',
      true,
      'Переведите единицу абсолютного изменения ставки; не применяйте относительный рост к самой ставке.',
      '25 bps = 0,25 процентного пункта. Значит, 2,00% + 0,25 п.п. = 2,25%. Относительный рост ставки на 25% дал бы другой результат.',
    ),
  ),
  en(
    'expressions',
    'm3-portfolio',
    2,
    m(
      'en02-e-benchmark-weights',
      'Match the expressions used when comparing portfolio weights with a benchmark.',
      [
        ['Overweight', 'Вес позиции выше соответствующего веса в ориентире'],
        ['Underweight', 'Вес позиции ниже соответствующего веса в ориентире'],
        ['Benchmark', 'Ориентир для сравнения структуры или результата'],
      ],
      'Здесь weight сравнивается с reference allocation, а не обозначает оценку качества компании.',
      'Overweight и underweight — относительные доли по сравнению с явно выбранным benchmark. Это не универсальная характеристика абсолютного размера позиции и не гарантия будущей доходности.',
    ),
  ),
  en(
    'expressions',
    'm2-npv',
    2,
    o(
      'en02-e-analyst-sequence',
      'Build a clear valuation explanation using the following analytical steps.',
      [
        'State the cash-flow and discount-rate assumptions',
        'Discount each dated cash flow to the valuation date',
        'Compare the resulting value with the proposed price',
        'Discuss sensitivity and material risks before deciding',
      ],
      'Обоснованное заключение начинается с предположений, затем даёт расчёт и сравнение, после чего раскрывает ограничения.',
      'Логика записки: сначала assumptions, затем discounting, затем value-versus-price comparison, затем sensitivity and risks. Числовая оценка без условий и существенных рисков не является полным аналитическим обоснованием.',
    ),
  ),
  en(
    'expressions',
    'm2-pv',
    2,
    c(
      'en02-e-all-else-equal',
      'An analyst writes: “All else equal, a higher discount rate lowers the present value of a fixed positive future payment.” What role does “all else equal” play?',
      [
        'It holds other relevant inputs constant for the comparison',
        'It says that every real-world risk disappears',
        'It means the payment date must change at the same time',
      ],
      0,
      'Фраза задаёт границы сравнения: выделяется влияние одного параметра.',
      'All else equal — при прочих равных. Платёж, дата и остальные параметры удерживаются неизменными, чтобы выделить влияние ставки. Это не утверждение об отсутствии рисков реального мира.',
      true,
    ),
  ),
  en(
    'expressions',
    'm3-diversification',
    1,
    c(
      'en02-e-past-performance',
      'What is the correct reading of “Past performance is not a reliable guarantee of future results”?',
      [
        'Historical results alone do not ensure that the future outcome will repeat',
        'Historical data must always be deleted',
        'A positive past return makes future losses impossible',
      ],
      0,
      'Разделите пользу исторических данных для анализа и невозможность вывести из них безусловное обещание.',
      'Прошлая доходность может быть материалом анализа, но не обеспечивает повторение результата. Для прогноза нужны предположения, оценка неопределённости и рисков; даже положительная история допускает будущие убытки.',
    ),
  ),
  en(
    'expressions',
    'm3-diversification',
    3,
    c(
      'en02-e-careful-reporting',
      'Which statements are appropriately qualified for an analyst’s report?',
      [
        'Under the base-case assumptions, NPV is positive',
        'The forecast return is guaranteed because the model is precise',
        'The historical Sharpe ratio is higher over the stated sample',
        'The portfolio may lose value despite diversification',
      ],
      [0, 2, 3],
      'Хорошая формулировка указывает условия, период выборки и неопределённость, не подменяя их гарантией.',
      'Under the base-case assumptions ограничивает модельный вывод. Historical и stated sample ограничивают статистическое сравнение. May lose value корректно раскрывает риск. Точность арифметики не делает прогноз гарантированным.',
    ),
  ),
];
