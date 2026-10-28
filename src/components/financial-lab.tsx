'use client';

import dynamic from 'next/dynamic';
import { useId, useRef, useState } from 'react';
import { ArrowDownUp, Calculator, Layers3, Plus, Trash2 } from 'lucide-react';
import { compoundInterest, futureValue, portfolioReturn, presentValue } from '@/lib/finance';
import { money, number, percent } from '@/lib/format';
import type { ChartPoint } from './financial-chart';
import styles from './lab.module.css';

const FinancialChart = dynamic(() => import('./financial-chart'), {
  ssr: false,
  loading: () => <div className={styles.chartLoading}>Загружаем график…</div>,
});
type Mode = 'compound' | 'discount' | 'portfolio';
const tools = [
  { id: 'compound' as const, title: 'Сложный процент', icon: Calculator },
  { id: 'discount' as const, title: 'Стоимость денег', icon: ArrowDownUp },
  { id: 'portfolio' as const, title: 'Доходность портфеля', icon: Layers3 },
];

function readNumeric(value: string, label: string): number {
  const normalized = value
    .trim()
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(',', '.');
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
    throw new Error(`«${label}»: введите конечное число.`);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`«${label}»: число слишком велико.`);
  return parsed;
}

function NumericField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  min: number;
  max: number;
  step?: number;
}) {
  const id = useId();
  const numeric = Number(value.replace(',', '.'));
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
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
        <span id={`${id}-unit`}>{unit}</span>
      </div>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : min}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label}: изменить ползунком`}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className={primary ? styles.primaryMetric : styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className={styles.error} role="alert">
      {message}
    </div>
  );
}

function CalculationTable({
  data,
  showContributions = false,
}: {
  data: ChartPoint[];
  showContributions?: boolean;
}) {
  return (
    <details className={styles.dataTable}>
      <summary>Таблица расчёта по годам</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Год</th>
              <th scope="col">Стоимость</th>
              {showContributions ? <th scope="col">Внесено</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.year}>
                <th scope="row">{number(point.year)}</th>
                <td>{money(point.value)}</td>
                {showContributions ? <td>{money(point.contributions ?? 0)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function CompoundCalculator({ compact = false }: { compact?: boolean }) {
  const [initial, setInitial] = useState('100000');
  const [monthly, setMonthly] = useState('5000');
  const [rate, setRate] = useState('10');
  const [years, setYears] = useState('10');
  const [frequency, setFrequency] = useState('12');
  let result: ReturnType<typeof compoundInterest> | null = null;
  let error = '';
  try {
    result = compoundInterest({
      initial: readNumeric(initial, 'Начальная сумма'),
      monthly: readNumeric(monthly, 'Ежемесячный взнос'),
      annualRate: readNumeric(rate, 'Годовая ставка') / 100,
      years: readNumeric(years, 'Срок'),
      frequency: Number(frequency),
    });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Проверьте параметры расчёта.';
  }
  return (
    <div className={compact ? styles.compact : ''}>
      <div className={styles.intro}>
        <span className={styles.kicker}>COMPOUND INTEREST</span>
        <h2>Пусть время работает на вас</h2>
        <p>Узнайте, как взносы и капитализация меняют будущую стоимость сбережений.</p>
      </div>
      <div className={styles.grid}>
        <div className={styles.controls}>
          <NumericField
            label="Начальная сумма"
            value={initial}
            onChange={setInitial}
            unit="₽"
            min={0}
            max={1000000}
            step={10000}
          />
          <NumericField
            label="Ежемесячный взнос"
            value={monthly}
            onChange={setMonthly}
            unit="₽ / мес."
            min={0}
            max={50000}
            step={500}
          />
          <NumericField
            label="Годовая ставка"
            value={rate}
            onChange={setRate}
            unit="%"
            min={-10}
            max={30}
            step={0.5}
          />
          <NumericField
            label="Срок инвестирования"
            value={years}
            onChange={setYears}
            unit="лет"
            min={0}
            max={40}
            step={1}
          />
          <label className={styles.selectLabel}>
            Капитализация
            <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
              <option value="1">Ежегодно</option>
              <option value="2">Раз в полгода</option>
              <option value="4">Ежеквартально</option>
              <option value="12">Ежемесячно</option>
              <option value="365">Ежедневно (365)</option>
            </select>
          </label>
        </div>
        <div className={styles.result}>
          {error || !result ? (
            <ErrorNotice message={error} />
          ) : (
            <>
              <div aria-live="polite" aria-atomic="true">
                <Metric label="Будущая стоимость" value={money(result.futureValue)} primary />
                <div className={styles.metrics}>
                  <Metric label="Всего внесено" value={money(result.contributions)} />
                  <Metric label="Результат инвестирования" value={money(result.growth)} />
                </div>
              </div>
              <figure className={styles.figure}>
                <FinancialChart data={result.series} showContributions />
                <figcaption>
                  <span className={styles.legendLine} />
                  Стоимость капитала <span className={styles.legendDashed} />
                  Взносы
                </figcaption>
              </figure>
              <CalculationTable data={result.series} showContributions />
            </>
          )}
        </div>
      </div>
      <p className={styles.assumption}>
        Учебная модель: постоянная номинальная ставка, взносы в конце каждого месяца. Между датами
        капитализации используется эквивалентная месячная ставка. Комиссии, налоги и инфляция не
        учитываются. Это расчёт по вашим предположениям, а не прогноз доходности.
      </p>
    </div>
  );
}

function DiscountCalculator({ compact = false }: { compact?: boolean }) {
  const [direction, setDirection] = useState<'pv' | 'fv'>('pv');
  const [amount, setAmount] = useState('121000');
  const [rate, setRate] = useState('10');
  const [years, setYears] = useState('2');
  let value: number | null = null;
  let series: ChartPoint[] = [];
  let error = '';
  try {
    const cash = readNumeric(amount, 'Денежная сумма');
    const discountRate = readNumeric(rate, 'Годовая ставка') / 100;
    const horizon = readNumeric(years, 'Горизонт');
    if (cash < 0) throw new Error('Денежная сумма должна быть неотрицательной.');
    if (horizon < 0 || horizon > 100 || !Number.isInteger(horizon))
      throw new Error('Горизонт: целое число от 0 до 100 лет.');
    const calculate = direction === 'pv' ? presentValue : futureValue;
    value = calculate(cash, discountRate, horizon);
    series = Array.from({ length: horizon + 1 }, (_, year) => ({
      year,
      value: calculate(cash, discountRate, year),
    }));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Проверьте параметры расчёта.';
  }
  return (
    <div className={compact ? styles.compact : ''}>
      <div className={styles.intro}>
        <span className={styles.kicker}>TIME VALUE OF MONEY</span>
        <h2>Одна сумма. Разные моменты времени.</h2>
        <p>Сравните сегодняшнюю и будущую стоимость денег при заданной ставке.</p>
      </div>
      <div className={styles.segment} role="group" aria-label="Направление расчёта">
        <button type="button" aria-pressed={direction === 'pv'} onClick={() => setDirection('pv')}>
          Настоящая стоимость · PV
        </button>
        <button type="button" aria-pressed={direction === 'fv'} onClick={() => setDirection('fv')}>
          Будущая стоимость · FV
        </button>
      </div>
      <div className={styles.grid}>
        <div className={styles.controls}>
          <NumericField
            label={direction === 'pv' ? 'Сумма в будущем' : 'Сумма сегодня'}
            value={amount}
            onChange={setAmount}
            unit="₽"
            min={0}
            max={1000000}
            step={1000}
          />
          <NumericField
            label={direction === 'pv' ? 'Ставка дисконтирования' : 'Годовая ставка роста'}
            value={rate}
            onChange={setRate}
            unit="%"
            min={-10}
            max={30}
            step={0.5}
          />
          <NumericField
            label="Горизонт"
            value={years}
            onChange={setYears}
            unit="лет"
            min={0}
            max={40}
            step={1}
          />
          <div className={styles.formula}>
            {direction === 'pv' ? 'PV = FV / (1 + r)ⁿ' : 'FV = PV × (1 + r)ⁿ'}
            <small>r — ставка за год в долях; n — число лет</small>
          </div>
        </div>
        <div className={styles.result}>
          {error || value === null ? (
            <ErrorNotice message={error} />
          ) : (
            <>
              <div aria-live="polite" aria-atomic="true">
                <Metric
                  label={direction === 'pv' ? 'Стоимость сегодня' : 'Стоимость в будущем'}
                  value={money(value)}
                  primary
                />
                <p className={styles.resultCaption}>
                  При ставке {rate}% и горизонте {years} лет
                </p>
              </div>
              <figure className={styles.figure}>
                <FinancialChart data={series} />
                <figcaption>
                  {direction === 'pv'
                    ? 'Как меняется PV одной будущей суммы при увеличении срока'
                    : 'Как меняется будущая стоимость сегодняшней суммы'}
                </figcaption>
              </figure>
              <CalculationTable data={series} />
            </>
          )}
        </div>
      </div>
      <p className={styles.assumption}>
        Учебные предположения: эффективная годовая ставка постоянна, один денежный поток, нет
        промежуточных выплат. PV — приведённая оценка будущего платежа, а не сумма на банковском
        счёте.
      </p>
    </div>
  );
}

type AssetInput = { id: string; name: string; weight: string; annualReturn: string };

function PortfolioCalculator({ compact = false }: { compact?: boolean }) {
  const [assets, setAssets] = useState<AssetInput[]>([
    { id: 'asset-1', name: 'Учебный актив A', weight: '60', annualReturn: '10' },
    { id: 'asset-2', name: 'Учебный актив B', weight: '40', annualReturn: '5' },
  ]);
  const counter = useRef(2);
  const [actionError, setActionError] = useState('');
  const patchAsset = (id: string, key: keyof Omit<AssetInput, 'id'>, value: string) => {
    setActionError('');
    setAssets((current) =>
      current.map((asset) => (asset.id === id ? { ...asset, [key]: value } : asset)),
    );
  };
  let weightedReturn: number | null = null;
  let weightSum: number | null = null;
  let error = '';
  let contributions: { id: string; name: string; value: number; weight: number }[] = [];
  try {
    const parsed = assets.map((asset) => ({
      weight: readNumeric(asset.weight, `Вес: ${asset.name}`) / 100,
      annualReturn: readNumeric(asset.annualReturn, `Доходность: ${asset.name}`) / 100,
    }));
    weightSum = parsed.reduce((sum, asset) => sum + asset.weight, 0);
    weightedReturn = portfolioReturn(parsed);
    contributions = parsed.map((asset, index) => ({
      id: assets[index].id,
      name: assets[index].name,
      value: asset.weight * asset.annualReturn,
      weight: asset.weight,
    }));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Проверьте параметры портфеля.';
  }
  const normalize = () => {
    try {
      const weights = assets.map((asset) => readNumeric(asset.weight, `Вес: ${asset.name}`));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (total <= 0 || weights.some((weight) => weight < 0))
        throw new Error('Для нормализации нужны неотрицательные веса с суммой больше нуля.');
      const normalized = weights.map((weight) => Number(((weight / total) * 100).toFixed(6)));
      normalized[normalized.length - 1] = Number(
        (100 - normalized.slice(0, -1).reduce((sum, weight) => sum + weight, 0)).toFixed(6),
      );
      setAssets((current) =>
        current.map((asset, index) => ({ ...asset, weight: String(normalized[index]) })),
      );
      setActionError('');
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Не удалось нормализовать веса.');
    }
  };
  return (
    <div className={compact ? styles.compact : ''}>
      <div className={styles.intro}>
        <span className={styles.kicker}>PORTFOLIO RETURN</span>
        <h2>Смотрите на портфель целиком</h2>
        <p>Задайте долю и доходность каждого актива за один и тот же период.</p>
      </div>
      <div className={styles.portfolioGrid}>
        <div className={styles.assets}>
          {assets.map((asset, index) => (
            <div key={asset.id} className={styles.asset}>
              <div className={styles.assetHeading}>
                <span className={styles.assetDot}>{String(index + 1).padStart(2, '0')}</span>
                <label className={styles.assetName}>
                  <span className={styles.visuallyHidden}>Название актива {index + 1}</span>
                  <input
                    aria-label={`Название актива ${index + 1}`}
                    value={asset.name}
                    onChange={(event) => patchAsset(asset.id, 'name', event.target.value)}
                    maxLength={60}
                  />
                </label>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Удалить ${asset.name}`}
                  disabled={assets.length <= 1}
                  onClick={() =>
                    setAssets((current) => current.filter((item) => item.id !== asset.id))
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className={styles.assetFields}>
                <label>
                  Вес, %
                  <input
                    inputMode="decimal"
                    value={asset.weight}
                    onChange={(event) => patchAsset(asset.id, 'weight', event.target.value)}
                    aria-label={`Вес актива ${index + 1}, %`}
                  />
                </label>
                <label>
                  Доходность, %
                  <input
                    inputMode="decimal"
                    value={asset.annualReturn}
                    onChange={(event) => patchAsset(asset.id, 'annualReturn', event.target.value)}
                    aria-label={`Доходность актива ${index + 1}, %`}
                  />
                </label>
              </div>
            </div>
          ))}
          <div className={styles.assetActions}>
            <button
              type="button"
              className={styles.outlineButton}
              disabled={assets.length >= 10}
              onClick={() => {
                counter.current += 1;
                setAssets((current) => [
                  ...current,
                  {
                    id: `asset-${counter.current}`,
                    name: `Учебный актив ${counter.current}`,
                    weight: '0',
                    annualReturn: '0',
                  },
                ]);
              }}
            >
              <Plus size={16} />
              Добавить актив
            </button>
            <span className={styles.weightSum}>
              Сумма весов: {weightSum === null ? '—' : percent(weightSum)}
            </span>
          </div>
          {weightSum !== null && Math.abs(weightSum - 1) > 1e-8 ? (
            <button type="button" className={styles.textButton} onClick={normalize}>
              Привести веса к 100% пропорционально
            </button>
          ) : null}
          {actionError ? <ErrorNotice message={actionError} /> : null}
        </div>
        <div className={styles.result}>
          {error || weightedReturn === null ? (
            <ErrorNotice message={error} />
          ) : (
            <>
              <div aria-live="polite" aria-atomic="true">
                <Metric label="Взвешенная доходность" value={percent(weightedReturn)} primary />
                <p className={styles.resultCaption}>За заданный единый период</p>
              </div>
              <div className={styles.portfolioBar} aria-label="Распределение весов">
                {contributions
                  .filter((item) => item.weight > 0)
                  .map((item, index) => (
                    <div
                      key={item.id}
                      style={{ flex: item.weight, opacity: Math.max(0.3, 1 - index * 0.08) }}
                      title={`${item.name}: ${percent(item.weight)}`}
                    />
                  ))}
              </div>
              <div className={styles.contributionList}>
                {contributions.map((item) => (
                  <div key={item.id}>
                    <span>{item.name}</span>
                    <strong>{number(item.value * 100, 2)} п.п.</strong>
                  </div>
                ))}
              </div>
              <p className={styles.resultCaption}>Вклад каждого актива в общую доходность</p>
              <div className={styles.formula}>
                Rₚ = Σ wᵢ × Rᵢ<small>wᵢ — доля актива; Rᵢ — его доходность</small>
              </div>
            </>
          )}
        </div>
      </div>
      <p className={styles.assumption}>
        Учебный расчёт для начальных весов без взносов, выводов и ребалансировки внутри периода.
        Веса должны составлять 100%; короткие позиции не поддерживаются. Доходности — введённые
        предположения, не рыночные котировки.
      </p>
    </div>
  );
}

export function LessonSandbox({ mode }: { mode: Mode }) {
  return (
    <div className={styles.sandbox}>
      {mode === 'compound' ? (
        <CompoundCalculator compact />
      ) : mode === 'discount' ? (
        <DiscountCalculator compact />
      ) : (
        <PortfolioCalculator compact />
      )}
    </div>
  );
}

export default function FinancialLab() {
  const [active, setActive] = useState<Mode>('compound');
  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="group" aria-label="Финансовые инструменты">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-pressed={active === tool.id}
            onClick={() => setActive(tool.id)}
          >
            <tool.icon size={18} />
            <span>{tool.title}</span>
          </button>
        ))}
      </div>
      <section
        className={styles.panel}
        aria-label={tools.find((tool) => tool.id === active)?.title}
      >
        {active === 'compound' ? (
          <CompoundCalculator />
        ) : active === 'discount' ? (
          <DiscountCalculator />
        ) : (
          <PortfolioCalculator />
        )}
      </section>
    </div>
  );
}
