import { describe, expect, it } from 'vitest';
import {
  compareInterest,
  compareRisk,
  discountValues,
  diversifyPortfolio,
  inflationPower,
  returnStatistics,
} from './concept-models';

describe('educational interest and purchasing power', () => {
  it('distinguishes interest on principal from reinvested interest', () => {
    const values = compareInterest(100000, 0.1, 2);
    expect(values.simple).toBeCloseTo(120000, 8);
    expect(values.compound).toBeCloseTo(121000, 8);
    expect(values.difference).toBeCloseTo(1000, 8);
    expect(values.points.map((point) => point.period)).toEqual([0, 1, 2]);
  });
  it('handles a zero rate and zero horizon without drift', () => {
    expect(compareInterest(1234, 0, 50).difference).toBe(0);
    expect(compareInterest(1234, 0.2, 0)).toMatchObject({ simple: 1234, compound: 1234 });
    expect(inflationPower(0, 0.1, 10).purchasingPowerChange).toBe(0);
  });
  it('supports a feasible negative interest scenario and rejects negative simple capital', () => {
    expect(compareInterest(100, -0.1, 2).compound).toBeCloseTo(81, 10);
    expect(() => compareInterest(100, -0.3, 5)).toThrow('отрицательный капитал');
  });
  it('uses exact purchasing power rather than linear subtraction', () => {
    expect(inflationPower(121000, 0.1, 2).realValue).toBeCloseTo(100000, 8);
    expect(inflationPower(100, -0.1, 1).realValue).toBeCloseTo(100 / 0.9, 10);
  });
  it('discounts the same future cashflow over increasing horizons', () => {
    const values = discountValues(121000, 0.1, 2);
    expect(values.presentValue).toBeCloseTo(100000, 8);
    expect(values.points[0].first).toBe(121000);
    expect(values.points[1].first).toBeCloseTo(110000, 8);
    expect(discountValues(100, -0.1, 1).presentValue).toBeGreaterThan(100);
  });
  it.each([NaN, Infinity, -Infinity])('rejects non-finite financial parameters %s', (invalid) => {
    expect(() => compareInterest(invalid, 0.1, 2)).toThrow();
    expect(() => inflationPower(100, invalid, 2)).toThrow();
    expect(() => discountValues(100, 0.1, invalid)).toThrow();
  });
  it('guards horizons, rates and amounts', () => {
    expect(() => compareInterest(-1, 0.1, 2)).toThrow();
    expect(() => inflationPower(100, -1, 2)).toThrow();
    expect(() => discountValues(100, 0.1, 2.5)).toThrow();
    expect(() => discountValues(100, 0.1, 51)).toThrow();
  });
});

describe('synthetic risk and diversification', () => {
  it('calculates the population standard deviation from observed scenario returns', () => {
    const values = returnStatistics([-0.1, 0.1]);
    expect(values.mean).toBe(0);
    expect(values.standardDeviation).toBeCloseTo(0.1, 12);
  });
  it('creates reproducible ten-period series with the stated arithmetic mean and volatility', () => {
    const input = { meanA: 0.06, meanB: 0.09, volatilityA: 0.05, volatilityB: 0.12 };
    const values = compareRisk(input);
    expect(values.points).toHaveLength(10);
    expect(values).toEqual(compareRisk(input));
    expect(values.statisticsA.mean).toBeCloseTo(0.06, 12);
    expect(values.statisticsB.standardDeviation).toBeCloseTo(0.12, 12);
    expect(values.statisticsB.standardDeviation).toBeGreaterThan(
      values.statisticsA.standardDeviation,
    );
  });
  it('allows risk-free constant returns and rejects losses below 100%', () => {
    expect(
      compareRisk({ meanA: 0, meanB: 0, volatilityA: 0, volatilityB: 0 }).statisticsA
        .standardDeviation,
    ).toBe(0);
    expect(() => compareRisk({ meanA: -0.9, meanB: 0, volatilityA: 1, volatilityB: 0 })).toThrow();
    expect(() => returnStatistics([])).toThrow();
  });
  it('matches analytical two-asset portfolio variance and weighted return', () => {
    const values = diversifyPortfolio({
      weightA: 0.6,
      returnA: 0.1,
      returnB: 0.05,
      volatilityA: 0.2,
      volatilityB: 0.1,
      correlation: 0.3,
    });
    expect(values.expectedReturn).toBeCloseTo(0.08, 12);
    expect(values.volatility).toBeCloseTo(Math.sqrt(0.0144 + 0.0016 + 0.00288), 12);
    expect(values.weightB).toBeCloseTo(0.4, 12);
  });
  it('shows the effect of correlation without changing expected return', () => {
    const input = { weightA: 0.5, returnA: 0.1, returnB: 0.04, volatilityA: 0.2, volatilityB: 0.2 };
    const positive = diversifyPortfolio({ ...input, correlation: 1 });
    const negative = diversifyPortfolio({ ...input, correlation: -1 });
    expect(positive.volatility).toBeCloseTo(0.2, 12);
    expect(negative.volatility).toBe(0);
    expect(negative.expectedReturn).toBe(positive.expectedReturn);
  });
  it('reduces to one asset at the portfolio endpoints', () => {
    const values = diversifyPortfolio({
      weightA: 1,
      returnA: 0.12,
      returnB: -0.1,
      volatilityA: 0.3,
      volatilityB: 0.1,
      correlation: -1,
    });
    expect(values.expectedReturn).toBe(0.12);
    expect(values.volatility).toBe(0.3);
    expect(values.points).toHaveLength(11);
  });
  it.each([NaN, Infinity, -Infinity])('rejects non-finite risk parameters %s', (invalid) => {
    expect(() => returnStatistics([invalid])).toThrow();
    expect(() =>
      diversifyPortfolio({
        weightA: 0.5,
        returnA: 0.1,
        returnB: 0.05,
        volatilityA: 0.2,
        volatilityB: 0.1,
        correlation: invalid,
      }),
    ).toThrow();
  });
  it('rejects weights and correlations outside their mathematical domains', () => {
    const input = {
      weightA: 0.5,
      returnA: 0.1,
      returnB: 0.05,
      volatilityA: 0.2,
      volatilityB: 0.1,
      correlation: 0,
    };
    expect(() => diversifyPortfolio({ ...input, weightA: 1.1 })).toThrow();
    expect(() => diversifyPortfolio({ ...input, correlation: -1.01 })).toThrow();
    expect(() => diversifyPortfolio({ ...input, volatilityA: -0.1 })).toThrow();
  });
});
