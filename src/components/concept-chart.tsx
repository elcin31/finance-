'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, number, percent } from '@/lib/format';
import type { ValuePoint } from '@/lib/concept-models';

export default function ConceptChart({
  points,
  labels,
  unit,
  axis,
}: {
  points: ValuePoint[];
  labels: [string, string];
  unit: 'money' | 'percent';
  axis: 'years' | 'periods' | 'weights';
}) {
  const displayValue = unit === 'money' ? money : percent;
  const displayPeriod = (value: number) =>
    axis === 'years'
      ? `${number(value)} г.`
      : axis === 'weights'
        ? `${number(value)}% A`
        : `${number(value)}`;
  return (
    <div style={{ width: '100%', height: 265, minWidth: 0 }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={points} margin={{ top: 16, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            tickFormatter={displayPeriod}
          />
          <YAxis
            width={52}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            tickFormatter={(value) =>
              unit === 'percent'
                ? `${number(Number(value) * 100, 1)}%`
                : new Intl.NumberFormat('ru-RU', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(Number(value))
            }
          />
          <Tooltip
            labelFormatter={(label) =>
              axis === 'years'
                ? `Горизонт: ${label} лет`
                : axis === 'weights'
                  ? `Вес A: ${label}%`
                  : `Период ${label}`
            }
            formatter={(value, name) => [
              displayValue(Number(value)),
              name === 'first' ? labels[0] : labels[1],
            ]}
            contentStyle={{
              border: '1px solid var(--line)',
              borderRadius: 10,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          <Line
            type={axis === 'periods' ? 'linear' : 'monotone'}
            dataKey="first"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={points.length < 12 ? { r: 2.5, fill: 'var(--accent)' } : false}
            isAnimationActive={false}
          />
          <Line
            type={axis === 'periods' ? 'linear' : 'monotone'}
            dataKey="second"
            stroke="#b28757"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
