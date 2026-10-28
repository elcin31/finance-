import { describe, expect, it } from 'vitest';
import { compoundInterest, futureValue, irr, npv, portfolioReturn, presentValue } from './finance';

const base = { initial: 100_000, monthly: 5_000, annualRate: 0.12, years: 10, frequency: 12 };

describe('compoundInterest', () => {
  it('matches the independent annuity formula with end-of-month contributions', () => {
    const result = compoundInterest(base);
    const growth = (1 + 0.12 / 12) ** 120;
    const expected = 100_000 * growth + 5_000 * ((growth - 1) / (0.12 / 12));
    expect(result.futureValue).toBeCloseTo(expected, 5);
    expect(result.contributions).toBe(700_000);
    expect(result.growth).toBeCloseTo(result.futureValue - 700_000, 8);
    expect(result.series).toHaveLength(11);
    expect(result.series[0]).toEqual({ year: 0, value: 100_000, contributions: 100_000 });
    expect(result.series.at(-1)?.value).toBe(result.futureValue);
  });

  it('does not grant a full month of interest to the contribution arriving at month end', () => {
    const result = compoundInterest({
      initial: 100,
      monthly: 10,
      annualRate: 0.12,
      years: 1 / 12,
      frequency: 12,
    });
    expect(result.futureValue).toBeCloseTo(111, 10);
    expect(result.series.at(-1)?.year).toBe(1 / 12);
  });

  it('uses equivalent monthly accrual for annual capitalization', () => {
    const result = compoundInterest({
      initial: 100,
      monthly: 0,
      annualRate: 0.21,
      years: 1,
      frequency: 1,
    });
    expect(result.futureValue).toBeCloseTo(121, 10);
    const contributionResult = compoundInterest({
      initial: 0,
      monthly: 100,
      annualRate: 0.21,
      years: 1,
      frequency: 1,
    });
    const monthlyFactor = 1.21 ** (1 / 12);
    const independentlySummed = Array.from(
      { length: 12 },
      (_, index) => 100 * monthlyFactor ** index,
    ).reduce((sum, value) => sum + value, 0);
    expect(contributionResult.futureValue).toBeCloseTo(independentlySummed, 8);
  });

  it('handles zero interest without division by zero', () => {
    const result = compoundInterest({ ...base, annualRate: 0 });
    expect(result.futureValue).toBe(700_000);
    expect(result.growth).toBe(0);
  });

  it('handles a zero horizon and a loss-making investment', () => {
    expect(compoundInterest({ ...base, years: 0 })).toEqual({
      futureValue: 100_000,
      contributions: 100_000,
      growth: 0,
      series: [{ year: 0, value: 100_000, contributions: 100_000 }],
    });
    expect(
      compoundInterest({ initial: 100, monthly: 0, annualRate: -0.1, years: 2, frequency: 1 })
        .futureValue,
    ).toBeCloseTo(81, 10);
  });

  it.each([
    { initial: -1 },
    { monthly: -1 },
    { initial: NaN },
    { monthly: Infinity },
    { annualRate: -1 },
    { annualRate: NaN },
    { annualRate: Infinity },
    { years: -1 },
    { years: 101 },
    { years: Infinity },
    { years: 0.01 },
    { frequency: 0 },
    { frequency: 1.5 },
    { frequency: 367 },
    { frequency: NaN },
  ])('rejects invalid input %o', (changes) => {
    expect(() => compoundInterest({ ...base, ...changes })).toThrow(RangeError);
  });

  it('rejects overflow instead of returning Infinity', () => {
    expect(() => compoundInterest({ ...base, initial: Number.MAX_VALUE, annualRate: 1 })).toThrow(
      /пределы/,
    );
  });
});

describe('presentValue and futureValue', () => {
  it('discounts and compounds the same amount reversibly', () => {
    expect(presentValue(121, 0.1, 2)).toBeCloseTo(100, 12);
    expect(futureValue(100, 0.1, 2)).toBeCloseTo(121, 12);
    expect(presentValue(futureValue(98_765.43, 0.075, 17.5), 0.075, 17.5)).toBeCloseTo(
      98_765.43,
      8,
    );
  });

  it('supports signed cashflows, fractional years, zero horizon and zero amounts', () => {
    expect(futureValue(-100, 0.21, 0.5)).toBeCloseTo(-110, 10);
    expect(presentValue(100, 0, 10)).toBe(100);
    expect(futureValue(100, 100, 0)).toBe(100);
    expect(presentValue(0, -0.999999999, 100)).toBe(0);
  });

  it.each([presentValue, futureValue])('rejects invalid input and overflow', (calculate) => {
    expect(() => calculate(100, -1, 1)).toThrow(/−100/);
    expect(() => calculate(100, NaN, 1)).toThrow(/конечное/);
    expect(() => calculate(Infinity, 0.1, 1)).toThrow(/конечное/);
    expect(() => calculate(100, 0.1, 101)).toThrow(/100 лет/);
    expect(() => calculate(100, 0.1, -1)).toThrow();
  });

  it('rejects an overflowing result', () => {
    expect(() => futureValue(Number.MAX_VALUE, 1, 2)).toThrow(/пределы/);
    expect(() => presentValue(Number.MAX_VALUE, -0.5, 2)).toThrow(/пределы/);
  });
});

describe('npv and irr', () => {
  it('places the initial outflow at t=0', () => {
    expect(npv([-100, 60, 60], 0.1)).toBeCloseTo(4.13223140495867, 10);
    expect(npv([-100, 60, 60], 0)).toBe(20);
    expect(npv([100], 0.1)).toBe(100);
  });

  it('solves conventional cashflows and verifies the root by substituting it into NPV', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 12);
    expect(irr([-100, 0, 121])).toBeCloseTo(0.1, 12);
    expect(irr([-100, 50])).toBeCloseTo(-0.5, 12);
    expect(irr([-100, 100])).toBeCloseTo(0, 12);
    expect(irr([-100, 1_000])).toBeCloseTo(9, 10);
    const cashflows = [-1_000, 100, 200, 300, 400, 500];
    expect(npv(cashflows, irr(cashflows))).toBeCloseTo(0, 8);
  });

  it('handles long zero-filled cashflow schedules without 0 × Infinity becoming NaN', () => {
    const cashflows = Array.from({ length: 101 }, (_, period) =>
      period === 0 ? -100 : period === 100 ? 200 : 0,
    );
    expect(irr(cashflows)).toBeCloseTo(2 ** 0.01 - 1, 12);
  });

  it.each(
    [
      [],
      [0],
      [-100],
      [100, 110],
      [-100, 0, 0],
      [-100, 230, -132],
      [-100, Infinity],
      [-100, NaN],
    ].map((cashflows) => ({ cashflows })),
  )('rejects an invalid or ambiguous IRR schedule $cashflows', ({ cashflows }) => {
    expect(() => irr(cashflows)).toThrow();
  });

  it('rejects invalid rates, excessive cashflow counts and results outside numerical range', () => {
    expect(() => npv([-100, 110], -1)).toThrow();
    expect(() => npv([], 0)).toThrow();
    expect(() =>
      npv(
        Array.from({ length: 1202 }, () => 1),
        0,
      ),
    ).toThrow();
    expect(() => npv([1, Number.MAX_VALUE], -0.99)).toThrow(/пределы/);
    expect(() => irr([-1e-30, 1])).toThrow(/пределы/);
  });
});

describe('portfolioReturn', () => {
  it('weights gains and losses without normalizing', () => {
    expect(
      portfolioReturn([
        { weight: 0.6, annualReturn: 0.1 },
        { weight: 0.4, annualReturn: -0.05 },
      ]),
    ).toBeCloseTo(0.04, 12);
    expect(portfolioReturn([{ weight: 1, annualReturn: -1 }])).toBe(-1);
    expect(
      portfolioReturn(Array.from({ length: 10 }, () => ({ weight: 0.1, annualReturn: 0.07 }))),
    ).toBeCloseTo(0.07, 12);
  });

  it.each(
    [
      [],
      [{ weight: 0.9, annualReturn: 0.1 }],
      [{ weight: 1.1, annualReturn: 0.1 }],
      [
        { weight: -0.1, annualReturn: 0.1 },
        { weight: 1.1, annualReturn: 0.1 },
      ],
      [{ weight: NaN, annualReturn: 0.1 }],
      [{ weight: 1, annualReturn: Infinity }],
      [{ weight: 1, annualReturn: -1.01 }],
    ].map((assets) => ({ assets })),
  )('rejects invalid portfolios $assets', ({ assets }) => {
    expect(() => portfolioReturn(assets)).toThrow(RangeError);
  });
});
