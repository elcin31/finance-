/** Pure financial calculations. Rates and asset weights are fractions, not percent points. */
export type CompoundInput = {
  initial: number;
  monthly: number;
  annualRate: number;
  years: number;
  frequency: number;
};

export type CompoundResult = {
  futureValue: number;
  contributions: number;
  growth: number;
  series: { year: number; value: number; contributions: number }[];
};

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name}: требуется конечное число.`);
}

function checkedResult(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(
      'Результат выходит за численные пределы. Уменьшите сумму, ставку или срок.',
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function validRate(rate: number): void {
  finite(rate, 'Ставка');
  if (rate <= -1) throw new RangeError('Ставка должна быть больше −100%.');
}

function validHorizon(years: number): void {
  finite(years, 'Срок');
  if (years < 0 || years > 100) throw new RangeError('Срок должен быть от 0 до 100 лет.');
}

/**
 * Nominal annual rate, frequency compounding periods/year. Contributions arrive
 * at each month end. Between compounding dates we use the equivalent monthly
 * growth factor (1 + annualRate/frequency) ** (frequency/12).
 */
export function compoundInterest(input: CompoundInput): CompoundResult {
  const { initial, monthly, annualRate, years, frequency } = input;
  finite(initial, 'Первоначальная сумма');
  finite(monthly, 'Ежемесячный взнос');
  validRate(annualRate);
  validHorizon(years);
  if (initial < 0 || monthly < 0)
    throw new RangeError('Первоначальная сумма и взнос не могут быть отрицательными.');
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 366) {
    throw new RangeError('Частота капитализации должна быть целым числом от 1 до 366.');
  }
  const months = Math.round(years * 12);
  if (Math.abs(years * 12 - months) > 1e-8) {
    throw new RangeError('Укажите срок с точностью до целого месяца.');
  }
  const monthlyRate = Math.expm1((frequency / 12) * Math.log1p(annualRate / frequency));
  const series: CompoundResult['series'] = [{ year: 0, value: initial, contributions: initial }];
  let value = initial;
  for (let month = 1; month <= months; month += 1) {
    value = checkedResult(
      annualRate === 0 ? initial + monthly * month : value * (1 + monthlyRate) + monthly,
    );
    if (month % 12 === 0 || month === months) {
      series.push({
        year: month / 12,
        value,
        contributions: checkedResult(initial + monthly * month),
      });
    }
  }
  const contributions = checkedResult(initial + monthly * months);
  return {
    futureValue: value,
    contributions,
    growth: checkedResult(value - contributions),
    series,
  };
}

/** Present value with an effective rate per year. */
export function presentValue(amount: number, rate: number, years: number): number {
  finite(amount, 'Сумма');
  validRate(rate);
  validHorizon(years);
  return amount === 0 ? 0 : checkedResult(amount * Math.exp(-years * Math.log1p(rate)));
}

/** Future value with an effective rate per year. */
export function futureValue(amount: number, rate: number, years: number): number {
  finite(amount, 'Сумма');
  validRate(rate);
  validHorizon(years);
  return amount === 0 ? 0 : checkedResult(amount * Math.exp(years * Math.log1p(rate)));
}

function validCashflows(cashflows: number[]): void {
  if (!Array.isArray(cashflows) || cashflows.length === 0 || cashflows.length > 1201) {
    throw new RangeError('Укажите от 1 до 1201 денежного потока.');
  }
  for (const cashflow of cashflows) finite(cashflow, 'Денежный поток');
}

/** NPV of equally spaced cashflows. cashflows[0] occurs now; rate is per period. */
export function npv(cashflows: number[], rate: number): number {
  validCashflows(cashflows);
  validRate(rate);
  let total = 0;
  let compensation = 0;
  const logRate = Math.log1p(rate);
  for (let period = 0; period < cashflows.length; period += 1) {
    const cashflow = cashflows[period];
    if (cashflow === 0) continue;
    const discounted = checkedResult(cashflow * Math.exp(-period * logRate));
    // Kahan summation reduces rounding error when discounted amounts differ.
    const corrected = discounted - compensation;
    const next = checkedResult(total + corrected);
    compensation = next - total - corrected;
    total = next;
  }
  return checkedResult(total);
}

/**
 * Unique periodic IRR for a conventional investment: initial outflow < 0,
 * all subsequent flows >= 0, and at least one inflow > 0. Other sign patterns
 * may have multiple IRRs and are deliberately rejected.
 */
export function irr(cashflows: number[]): number {
  validCashflows(cashflows);
  if (
    cashflows.length < 2 ||
    cashflows[0] >= 0 ||
    cashflows.slice(1).some((flow) => flow < 0) ||
    !cashflows.slice(1).some((flow) => flow > 0)
  ) {
    throw new RangeError(
      'IRR поддерживает начальное вложение < 0 и последующие поступления ≥ 0, среди которых есть положительное.',
    );
  }
  // Positive discounted inflows can overflow near -100%; +Infinity still
  // provides a valid sign for bracketing, without leaking it as a result.
  const valueAt = (rate: number): number => {
    const logRate = Math.log1p(rate);
    let value = cashflows[0];
    for (let period = 1; period < cashflows.length; period += 1) {
      if (cashflows[period] !== 0) value += cashflows[period] * Math.exp(-period * logRate);
    }
    return value;
  };
  let lower = -1 + Number.EPSILON;
  let upper = 1;
  const maxRate = 1e12;
  if (valueAt(lower) < 0) throw new RangeError('IRR слишком близка к −100% для надёжного расчёта.');
  while (valueAt(upper) > 0 && upper < maxRate) upper = Math.min(maxRate, upper * 2 + 1);
  if (valueAt(upper) > 0) throw new RangeError('IRR выходит за численные пределы расчёта.');
  for (let iteration = 0; iteration < 180; iteration += 1) {
    const midpoint = lower + (upper - lower) / 2;
    if (midpoint === lower || midpoint === upper) return checkedResult(midpoint);
    const value = valueAt(midpoint);
    if (value === 0) return checkedResult(midpoint);
    if (value > 0) lower = midpoint;
    else upper = midpoint;
  }
  return checkedResult(lower + (upper - lower) / 2);
}

/** Unlevered, long-only portfolio. Weights must sum to 1; no normalization. */
export function portfolioReturn(assets: { weight: number; annualReturn: number }[]): number {
  if (!Array.isArray(assets) || assets.length === 0 || assets.length > 1000)
    throw new RangeError('Добавьте от 1 до 1000 активов.');
  let totalWeight = 0;
  let weightedReturn = 0;
  for (const asset of assets) {
    finite(asset.weight, 'Вес актива');
    finite(asset.annualReturn, 'Доходность актива');
    if (asset.weight < 0 || asset.weight > 1)
      throw new RangeError('Вес актива должен быть от 0 до 100% (например, 0,6 для 60%).');
    if (asset.annualReturn < -1)
      throw new RangeError('Доходность актива без заёмного плеча не может быть ниже −100%.');
    totalWeight += asset.weight;
    weightedReturn += asset.weight * asset.annualReturn;
  }
  if (Math.abs(totalWeight - 1) > 1e-8)
    throw new RangeError('Сумма весов должна составлять 100%. Скорректируйте веса активов.');
  return checkedResult(weightedReturn);
}
