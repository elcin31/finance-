/** Shared Russian formatting; financial function rates are fractions. */
const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function zero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function money(value: number): string {
  return Number.isFinite(value) ? currencyFormatter.format(zero(value)) : '—';
}

/** Takes a fraction: percent(0.075) → «7,5 %». */
export function percent(value: number): string {
  return Number.isFinite(value) ? percentFormatter.format(zero(value)) : '—';
}

export function number(value: number, digits = 2): string {
  if (!Number.isInteger(digits) || digits < 0 || digits > 12)
    throw new RangeError('Точность должна быть целым числом от 0 до 12.');
  return Number.isFinite(value)
    ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(zero(value))
    : '—';
}
