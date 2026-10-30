'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { ChartNoAxesCombined, Coins, GitBranch, LineChart, TrendingDown } from 'lucide-react';
import {
  compareInterest,
  compareRisk,
  discountValues,
  diversifyPortfolio,
  inflationPower,
  type ValuePoint,
} from '@/lib/concept-models';
import { money, number, percent } from '@/lib/format';
import styles from './concepts.module.css';

const ConceptChart = dynamic(() => import('./concept-chart'), {
  ssr: false,
  loading: () => (
    <div className={styles.chartLoading} role="status">
      Загружаем учебный график…
    </div>
  ),
});
export type ConceptMode = 'interest' | 'inflation' | 'discount' | 'risk' | 'diversification';
type Values = Record<string, string>;
type Field = { id: string; label: string; unit: string; min: number; max: number; step: number };
type View = {
  points: ValuePoint[];
  labels: [string, string];
  unit: 'money' | 'percent';
  axis: 'years' | 'periods' | 'weights';
  metrics: { label: string; value: string }[];
  explanation: string;
  weights?: [number, number];
};
const definitions: Record<
  ConceptMode,
  {
    title: string;
    english: string;
    introduction: string;
    formula: string;
    assumptions: string;
    fields: Field[];
  }
> = {
  interest: {
    title: 'Два способа начисления процентов',
    english: 'SIMPLE VS COMPOUND INTEREST',
    introduction:
      'Измените ставку и горизонт: у простого процента база остаётся прежней, у сложного — меняется после каждого начисления.',
    formula: 'Простые: P × (1 + r × n). Сложные: P × (1 + r)ⁿ.',
    assumptions:
      'P — начальный капитал, r — годовая ставка в долях, n — годы. Капитализация ежегодная, новых взносов нет. Комиссии, налоги и инфляция не учтены.',
    fields: [
      { id: 'principal', label: 'Начальный капитал', unit: '₽', min: 0, max: 1000000, step: 10000 },
      { id: 'rate', label: 'Процентная ставка', unit: '% в год', min: 0, max: 25, step: 0.5 },
      { id: 'years', label: 'Горизонт сравнения', unit: 'лет', min: 0, max: 30, step: 1 },
    ],
  },
  inflation: {
    title: 'Одна сумма — разная покупательная способность',
    english: 'INFLATION & PURCHASING POWER',
    introduction:
      'Номинальная сумма может остаться прежней, пока цены растут. Посмотрите, сколько сегодняшних товаров она сможет оплатить позже.',
    formula: 'Покупательная способность = P / (1 + i)ⁿ.',
    assumptions:
      'i — постоянная годовая инфляция в долях, n — годы. График выражает будущую неизменную сумму в сегодняшних ценах. Это учебное допущение, не прогноз инфляции.',
    fields: [
      { id: 'principal', label: 'Неизменная сумма', unit: '₽', min: 0, max: 1000000, step: 10000 },
      {
        id: 'rate',
        label: 'Предполагаемая инфляция',
        unit: '% в год',
        min: -5,
        max: 20,
        step: 0.5,
      },
      { id: 'years', label: 'Период изменения цен', unit: 'лет', min: 0, max: 30, step: 1 },
    ],
  },
  discount: {
    title: 'Как ставка меняет стоимость будущего платежа',
    english: 'DISCOUNT RATE & PRESENT VALUE',
    introduction:
      'Будущий платёж фиксирован. Меняйте требуемую доходность: чем она выше, тем меньше стоит право на этот платёж сегодня.',
    formula: 'PV = FV / (1 + r)ⁿ.',
    assumptions:
      'FV — один будущий платёж, r — эффективная годовая ставка дисконтирования, n — число лет до платежа. Каждый узел графика показывает отдельный горизонт для той же суммы FV.',
    fields: [
      { id: 'amount', label: 'Будущий платёж', unit: '₽', min: 0, max: 1000000, step: 10000 },
      { id: 'rate', label: 'Ставка дисконтирования', unit: '% в год', min: -5, max: 30, step: 0.5 },
      { id: 'years', label: 'Лет до получения платежа', unit: 'лет', min: 0, max: 30, step: 1 },
    ],
  },
  risk: {
    title: 'Средняя доходность не описывает весь путь',
    english: 'RISK & RETURN',
    introduction:
      'У двух условных активов могут отличаться и средний результат, и сила колебаний. Сравните доходности десяти учебных периодов.',
    formula: 'μ = Σrₜ / N; σ = √[Σ(rₜ − μ)² / N].',
    assumptions:
      'Синтетические ряды из 10 периодов построены по фиксированному шаблону с заданными средней и стандартным отклонением. σ считается как отклонение всей показанной совокупности, с делением на N. Средняя — арифметическая, не CAGR. Больше риска не гарантирует больше прибыли.',
    fields: [
      {
        id: 'meanA',
        label: 'Средняя доходность A',
        unit: '% за период',
        min: -10,
        max: 25,
        step: 0.5,
      },
      {
        id: 'meanB',
        label: 'Средняя доходность B',
        unit: '% за период',
        min: -10,
        max: 25,
        step: 0.5,
      },
      { id: 'volA', label: 'Колебания A — σ', unit: '%', min: 0, max: 30, step: 0.5 },
      { id: 'volB', label: 'Колебания B — σ', unit: '%', min: 0, max: 30, step: 0.5 },
    ],
  },
  diversification: {
    title: 'Состав портфеля и связь между активами',
    english: 'PORTFOLIO DIVERSIFICATION',
    introduction:
      'Меняйте долю A и корреляцию ρ. При тех же исходных доходностях и рисках менее синхронные колебания могут снизить общий риск портфеля.',
    formula: 'E[Rₚ] = wRₐ + (1 − w)Rᵦ; σₚ² = w²σₐ² + (1 − w)²σᵦ² + 2w(1 − w)ρσₐσᵦ.',
    assumptions:
      'Два условных актива: A — доходность 10% и σ 20%, B — доходность 5% и σ 10% за один и тот же период. Без заёмного плеча, комиссий и внешних денежных потоков. Доходности и корреляция — сценарные предположения, не рыночные оценки.',
    fields: [
      { id: 'weightA', label: 'Доля актива A', unit: '% портфеля', min: 0, max: 100, step: 1 },
      { id: 'correlation', label: 'Корреляция ρ', unit: 'от −1 до 1', min: -1, max: 1, step: 0.1 },
    ],
  },
};
const concepts: { id: ConceptMode; label: string; icon: typeof Coins }[] = [
  { id: 'interest', label: 'Начисление процентов', icon: Coins },
  { id: 'inflation', label: 'Инфляция', icon: TrendingDown },
  { id: 'discount', label: 'Дисконтирование', icon: ChartNoAxesCombined },
  { id: 'risk', label: 'Риск и доходность', icon: LineChart },
  { id: 'diversification', label: 'Диверсификация', icon: GitBranch },
];
const initialValues: Record<ConceptMode, Values> = {
  interest: { principal: '100000', rate: '10', years: '10' },
  inflation: { principal: '100000', rate: '6', years: '10' },
  discount: { amount: '121000', rate: '10', years: '2' },
  risk: { meanA: '6', meanB: '9', volA: '5', volB: '12' },
  diversification: { weightA: '60', correlation: '0.3' },
};

function readNumber(raw: string, label: string): number {
  const value = raw
    .trim()
    .replace(/[ \u00a0\u202f]/g, '')
    .replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
    throw new RangeError(`«${label}»: введите число с точкой или запятой.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new RangeError(`«${label}»: требуется конечное число.`);
  return parsed;
}

function model(mode: ConceptMode, values: Values): View {
  const value = (key: string) =>
    readNumber(
      values[key] ?? '',
      definitions[mode].fields.find((field) => field.id === key)?.label ?? key,
    );
  if (mode === 'interest') {
    const rate = value('rate') / 100;
    const data = compareInterest(value('principal'), rate, value('years'));
    return {
      points: data.points,
      labels: ['Простые проценты', 'Сложные проценты'],
      unit: 'money',
      axis: 'years',
      metrics: [
        { label: 'Простые проценты', value: money(data.simple) },
        { label: 'С капитализацией', value: money(data.compound) },
        { label: 'Разница моделей', value: money(data.difference) },
      ],
      explanation:
        rate > 0
          ? 'Доход, начисленный раньше, сам начинает приносить доход. При равной положительной ставке разница растёт с горизонтом; в первый год результаты совпадают.'
          : rate === 0
            ? 'При нулевой ставке дохода нет: обе модели сохраняют начальную сумму на любом горизонте.'
            : 'При отрицательной ставке капитал уменьшается. Простая модель каждый год списывает долю исходного капитала, сложная — долю оставшегося.',
    };
  }
  if (mode === 'inflation') {
    const data = inflationPower(value('principal'), value('rate') / 100, value('years'));
    return {
      points: data.points,
      labels: ['Номинальная сумма', 'В сегодняшних ценах'],
      unit: 'money',
      axis: 'years',
      metrics: [
        { label: 'На счёте номинально', value: money(data.nominalValue) },
        { label: 'Покупательная способность', value: money(data.realValue) },
        { label: 'Изменение способности покупать', value: percent(data.purchasingPowerChange) },
      ],
      explanation:
        value('rate') > 0
          ? 'При росте цен неизменная сумма оплачивает меньше товаров. Снижение покупательной способности нелинейно: цены накапливают рост по сложной ставке.'
          : value('rate') < 0
            ? 'В сценарии дефляции цены снижаются, поэтому неизменная денежная сумма покупает больше. Это результат заданного отрицательного темпа цен, не прогноз.'
            : 'При неизменных ценах номинальная и реальная сумма совпадают. Здесь не учитывается доход от размещения денег.',
    };
  }
  if (mode === 'discount') {
    const data = discountValues(value('amount'), value('rate') / 100, value('years'));
    return {
      points: data.points,
      labels: ['Текущая стоимость PV', 'Будущий платёж FV'],
      unit: 'money',
      axis: 'years',
      metrics: [
        { label: 'Будущий платёж', value: money(data.futureAmount) },
        { label: 'Его текущая стоимость', value: money(data.presentValue) },
        { label: 'Ставка дисконтирования', value: percent(value('rate') / 100) },
      ],
      explanation:
        value('rate') > 0
          ? 'Более высокая требуемая доходность или более далёкая дата уменьшают PV. Получить фиксированную сумму позже менее ценно, если есть положительная альтернатива заработать.'
          : value('rate') < 0
            ? 'При отрицательной ставке текущая стоимость положительного будущего платежа может превышать его номинал. Формула остаётся согласованной при r > −100%.'
            : 'При нулевой ставке время не меняет оценку этого платежа: PV равно FV.',
    };
  }
  if (mode === 'risk') {
    const data = compareRisk({
      meanA: value('meanA') / 100,
      meanB: value('meanB') / 100,
      volatilityA: value('volA') / 100,
      volatilityB: value('volB') / 100,
    });
    return {
      points: data.points,
      labels: ['Актив A', 'Актив B'],
      unit: 'percent',
      axis: 'periods',
      metrics: [
        {
          label: 'Средняя A / B',
          value: `${percent(data.statisticsA.mean)} / ${percent(data.statisticsB.mean)}`,
        },
        {
          label: 'Колебания A / B',
          value: `${percent(data.statisticsA.standardDeviation)} / ${percent(data.statisticsB.standardDeviation)}`,
        },
        { label: 'Минимум B в сценарии', value: percent(data.statisticsB.minimum) },
      ],
      explanation:
        'Увеличьте σ одного актива, сохранив его среднюю: линия станет менее ровной, но среднее не изменится. Измените только среднюю — весь ряд сдвинется. Поэтому оценка результата требует обоих показателей.',
    };
  }
  const data = diversifyPortfolio({
    weightA: value('weightA') / 100,
    correlation: value('correlation'),
    returnA: 0.1,
    returnB: 0.05,
    volatilityA: 0.2,
    volatilityB: 0.1,
  });
  return {
    points: data.points,
    labels: ['Сценарная доходность', 'Риск портфеля — σ'],
    unit: 'percent',
    axis: 'weights',
    metrics: [
      { label: 'Доходность выбранного состава', value: percent(data.expectedReturn) },
      { label: 'Риск выбранного состава', value: percent(data.volatility) },
      { label: 'Вес A / B', value: `${percent(data.weightA)} / ${percent(data.weightB)}` },
    ],
    weights: [data.weightA, data.weightB],
    explanation:
      data.volatility < 1e-10
        ? 'В этой идеализированной точке отрицательная корреляция и веса полностью компенсируют колебания. В реальных данных такая связь может меняться; модель не гарантирует безрисковую доходность.'
        : 'При изменении ρ сценарная доходность состава остаётся прежней, а риск меняется. При ρ = 1 риск — взвешенная сумма σ; при меньшей корреляции появляется эффект диверсификации. График показывает все веса, а числа выше — выбранный состав.',
  };
}

function ParameterField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const numeric = Number(value.replace(',', '.'));
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{field.label}</label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-unit`}
        />
        <span id={`${id}-unit`}>{field.unit}</span>
      </div>
      <input
        type="range"
        className={styles.range}
        min={field.min}
        max={field.max}
        step={field.step}
        value={
          Number.isFinite(numeric) ? Math.min(field.max, Math.max(field.min, numeric)) : field.min
        }
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${field.label}: изменить ползунком`}
      />
    </div>
  );
}

function DataTable({ view }: { view: View }) {
  const displayValue = view.unit === 'money' ? money : percent;
  return (
    <details className={styles.table}>
      <summary>Открыть таблицу учебного расчёта</summary>
      <div className={styles.tableScroll}>
        <table>
          <caption>
            Все точки графика. {view.unit === 'money' ? 'Суммы в рублях.' : 'Значения в процентах.'}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {view.axis === 'years'
                  ? 'Горизонт, лет'
                  : view.axis === 'weights'
                    ? 'Вес A, %'
                    : 'Период'}
              </th>
              <th scope="col">{view.labels[0]}</th>
              <th scope="col">{view.labels[1]}</th>
            </tr>
          </thead>
          <tbody>
            {view.points.map((point) => (
              <tr key={point.period}>
                <th scope="row">{number(point.period)}</th>
                <td>{displayValue(point.first)}</td>
                <td>{point.second === undefined ? '—' : displayValue(point.second)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function ConceptExplorer({
  initialMode = 'interest',
  compact = false,
}: {
  initialMode?: ConceptMode;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<ConceptMode>(initialMode);
  const [values, setValues] = useState<Record<ConceptMode, Values>>(
    () =>
      Object.fromEntries(
        Object.entries(initialValues).map(([key, value]) => [key, { ...value }]),
      ) as Record<ConceptMode, Values>,
  );
  const definition = definitions[mode];
  let view: View | null = null;
  let error = '';
  try {
    view = model(mode, values[mode]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Проверьте параметры модели.';
  }
  return (
    <section
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      aria-label="Интерактивные учебные модели"
    >
      {!compact && (
        <nav className={styles.tabs} aria-label="Выбрать финансовую концепцию">
          {concepts.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className={styles.panel}>
        <header className={styles.introduction}>
          <span className={styles.eyebrow}>{definition.english}</span>
          <h2>{definition.title}</h2>
          <p>{definition.introduction}</p>
          <span className={styles.badge}>Учебная модель · без рыночных данных</span>
        </header>
        <div className={styles.grid}>
          <div className={styles.controls}>
            {definition.fields.map((field) => (
              <ParameterField
                key={`${mode}-${field.id}`}
                field={field}
                value={values[mode][field.id]}
                onChange={(value) =>
                  setValues((previous) => ({
                    ...previous,
                    [mode]: { ...previous[mode], [field.id]: value },
                  }))
                }
              />
            ))}
            <div className={styles.formula}>
              <span>Формула и переменные</span>
              <p>{definition.formula}</p>
            </div>
          </div>
          <div className={styles.result}>
            {error || !view ? (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            ) : (
              <>
                <div className={styles.metrics} aria-live="polite" aria-atomic="true">
                  {view.metrics.map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
                {view.weights && (
                  <div className={styles.allocation}>
                    <div className={styles.allocationBar} aria-hidden="true">
                      <span style={{ width: `${view.weights[0] * 100}%` }} />
                      <span style={{ width: `${view.weights[1] * 100}%` }} />
                    </div>
                    <p>
                      Актив A: {percent(view.weights[0])} · Актив B: {percent(view.weights[1])}
                    </p>
                  </div>
                )}
                <figure className={styles.figure}>
                  <ConceptChart
                    points={view.points}
                    labels={view.labels}
                    unit={view.unit}
                    axis={view.axis}
                  />
                  <figcaption>
                    <span>
                      <i />
                      {view.labels[0]}
                    </span>
                    <span>
                      <i />
                      {view.labels[1]}
                    </span>
                  </figcaption>
                </figure>
                <div className={styles.takeaway}>
                  <strong>Что меняется и почему</strong>
                  <p>{view.explanation}</p>
                </div>
                <DataTable view={view} />
              </>
            )}
          </div>
        </div>
        <p className={styles.assumptions}>{definition.assumptions}</p>
      </div>
    </section>
  );
}
