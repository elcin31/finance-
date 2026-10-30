/** Educational models. Rates are fractions; no prices or market observations are used. */
export type ValuePoint = { period: number; first: number; second?: number };

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label}: введите конечное число.`);
}
function amount(value: number): void {
  finite(value, 'Денежная сумма');
  if (value < 0 || value > 1e15) throw new RangeError('Сумма должна быть от 0 до 1 000 трлн ₽.');
}
function horizon(years: number): void {
  finite(years, 'Срок');
  if (!Number.isInteger(years) || years < 0 || years > 50)
    throw new RangeError('Для этой модели укажите целое число лет от 0 до 50.');
}
function rate(value: number): void {
  finite(value, 'Ставка');
  if (value <= -1 || value > 5)
    throw new RangeError('Ставка должна быть больше −100% и не выше 500% в год.');
}
function result(value: number): number {
  if (!Number.isFinite(value))
    throw new RangeError('Результат слишком велик. Уменьшите параметры.');
  return Object.is(value, -0) ? 0 : value;
}

export function compareInterest(principal: number, annualRate: number, years: number) {
  amount(principal);
  rate(annualRate);
  horizon(years);
  if (1 + annualRate * years < 0)
    throw new RangeError(
      'Простая модель дала бы отрицательный капитал. Уменьшите срок или отрицательную ставку.',
    );
  const points: ValuePoint[] = [];
  for (let period = 0; period <= years; period++) {
    points.push({
      period,
      first: result(principal * (1 + annualRate * period)),
      second: result(principal * Math.exp(period * Math.log1p(annualRate))),
    });
  }
  const last = points[points.length - 1];
  return {
    points,
    simple: last.first,
    compound: last.second!,
    difference: result(last.second! - last.first),
  };
}

export function inflationPower(principal: number, inflation: number, years: number) {
  amount(principal);
  rate(inflation);
  horizon(years);
  const points: ValuePoint[] = [];
  for (let period = 0; period <= years; period++) {
    points.push({
      period,
      first: principal,
      second: result(principal * Math.exp(-period * Math.log1p(inflation))),
    });
  }
  const realValue = points[points.length - 1].second!;
  return {
    points,
    nominalValue: principal,
    realValue,
    purchasingPowerChange: principal === 0 ? 0 : result(realValue / principal - 1),
  };
}

export function discountValues(futureAmount: number, discountRate: number, years: number) {
  amount(futureAmount);
  rate(discountRate);
  horizon(years);
  const points: ValuePoint[] = [];
  for (let period = 0; period <= years; period++) {
    points.push({
      period,
      first: result(futureAmount * Math.exp(-period * Math.log1p(discountRate))),
      second: futureAmount,
    });
  }
  return { points, presentValue: points[points.length - 1].first, futureAmount };
}

export function returnStatistics(returns: number[]) {
  if (!returns.length || returns.length > 1000)
    throw new RangeError('Нужен набор из 1–1000 доходностей.');
  returns.forEach((value) => {
    finite(value, 'Доходность');
    if (value < -1 || value > 10)
      throw new RangeError('Доходности модели должны быть от −100% до 1000%.');
  });
  const mean = result(returns.reduce((total, value) => total + value, 0) / returns.length);
  const variance = result(
    returns.reduce((total, value) => total + (value - mean) ** 2, 0) / returns.length,
  );
  return {
    mean,
    standardDeviation: result(Math.sqrt(variance)),
    minimum: Math.min(...returns),
    maximum: Math.max(...returns),
  };
}

const patternA = [-1, 1, -0.5, 0.5, -1.5, 1.5, -0.75, 0.75, -1.25, 1.25];
const patternB = [0.5, -0.5, -1, 1, -0.75, 0.75, -1.5, 1.5, -1.25, 1.25];
function normalizedPattern(pattern: number[]) {
  const sigma = Math.sqrt(pattern.reduce((sum, value) => sum + value ** 2, 0) / pattern.length);
  return pattern.map((value) => value / sigma);
}
const normalizedA = normalizedPattern(patternA);
const normalizedB = normalizedPattern(patternB);

export function compareRisk(input: {
  meanA: number;
  meanB: number;
  volatilityA: number;
  volatilityB: number;
}) {
  const { meanA, meanB, volatilityA, volatilityB } = input;
  [meanA, meanB].forEach((value) => {
    finite(value, 'Средняя доходность');
    if (value < -1 || value > 2)
      throw new RangeError('Средняя доходность учебного сценария: от −100% до 200%.');
  });
  [volatilityA, volatilityB].forEach((value) => {
    finite(value, 'Волатильность');
    if (value < 0 || value > 1) throw new RangeError('Волатильность должна быть от 0% до 100%.');
  });
  const returnsA = normalizedA.map((value) => meanA + volatilityA * value);
  const returnsB = normalizedB.map((value) => meanB + volatilityB * value);
  const statisticsA = returnStatistics(returnsA);
  const statisticsB = returnStatistics(returnsB);
  const points: ValuePoint[] = returnsA.map((value, index) => ({
    period: index + 1,
    first: value,
    second: returnsB[index],
  }));
  return { points, statisticsA, statisticsB };
}

export type DiversificationInput = {
  weightA: number;
  returnA: number;
  returnB: number;
  volatilityA: number;
  volatilityB: number;
  correlation: number;
};
export function diversifyPortfolio(input: DiversificationInput) {
  const { weightA, returnA, returnB, volatilityA, volatilityB, correlation } = input;
  Object.entries(input).forEach(([key, value]) => finite(value, key));
  if (weightA < 0 || weightA > 1) throw new RangeError('Вес актива A должен быть от 0% до 100%.');
  if (correlation < -1 || correlation > 1)
    throw new RangeError('Корреляция должна быть от −1 до 1.');
  if (volatilityA < 0 || volatilityA > 1 || volatilityB < 0 || volatilityB > 1)
    throw new RangeError('Волатильности должны быть от 0% до 100%.');
  if (returnA < -1 || returnB < -1 || returnA > 2 || returnB > 2)
    throw new RangeError('Доходности сценария должны быть от −100% до 200%.');
  const calculate = (weight: number) => {
    const other = 1 - weight;
    const variance =
      weight ** 2 * volatilityA ** 2 +
      other ** 2 * volatilityB ** 2 +
      2 * weight * other * correlation * volatilityA * volatilityB;
    // At perfect negative correlation, floating point arithmetic can leave a tiny negative residue.
    if (variance < -1e-12) throw new RangeError('Некорректная дисперсия портфеля.');
    return {
      expectedReturn: result(weight * returnA + other * returnB),
      volatility: result(Math.sqrt(Math.max(0, variance))),
    };
  };
  const points: ValuePoint[] = Array.from({ length: 11 }, (_, index) => {
    const values = calculate(index / 10);
    return { period: index * 10, first: values.expectedReturn, second: values.volatility };
  });
  return { points, weightA, weightB: 1 - weightA, ...calculate(weightA) };
}
