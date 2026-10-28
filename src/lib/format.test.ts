import { describe, expect, it } from 'vitest';
import { money, number, percent } from './format';

const spaces = (value: string) => value.replace(/[\u00a0\u202f]/gu, ' ');

describe('Russian financial formatting', () => {
  it('formats money, decimal comma and fractional percent consistently', () => {
    expect(spaces(money(1234.56))).toBe('1 234,56 ₽');
    expect(spaces(percent(0.075))).toBe('7,5 %');
    expect(spaces(number(1234.567))).toBe('1 234,57');
    expect(number(1.75, 0)).toBe('2');
  });

  it('never displays NaN, Infinity or negative zero', () => {
    for (const format of [money, percent, number]) {
      expect(format(NaN)).toBe('—');
      expect(format(Infinity)).toBe('—');
      expect(format(-Infinity)).toBe('—');
      expect(format(-0)).not.toContain('-');
    }
  });

  it('rejects invalid precision', () => {
    expect(() => number(1, -1)).toThrow(RangeError);
    expect(() => number(1, 1.5)).toThrow(RangeError);
    expect(() => number(1, 13)).toThrow(RangeError);
  });
});
