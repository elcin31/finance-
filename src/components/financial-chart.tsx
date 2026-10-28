'use client';

import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '@/lib/format';

export type ChartPoint = { year: number; value: number; contributions?: number };

export default function FinancialChart({
  data,
  showContributions = false,
}: {
  data: ChartPoint[];
  showContributions?: boolean;
}) {
  const gradient = useId().replace(/:/g, '');
  return (
    <div style={{ width: '100%', height: 260, minWidth: 0 }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 14, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b8a70" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2b8a70" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line, #e4e9e5)" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 11, fill: 'var(--muted, #69776e)' }}
            tickFormatter={(value) => `${value} г.`}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: 'var(--muted, #69776e)' }}
            tickFormatter={(value) =>
              new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(Number(value))
            }
          />
          <Tooltip
            labelFormatter={(label) => `Год ${label}`}
            formatter={(value, name) => [
              money(Number(value)),
              name === 'contributions' ? 'Внесено' : 'Стоимость',
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--line, #e4e9e5)',
              background: 'var(--surface, #fff)',
              color: 'var(--text, #142b23)',
              fontSize: 12,
            }}
          />
          {showContributions ? (
            <Area
              type="monotone"
              dataKey="contributions"
              stroke="#9aa9a2"
              fill="transparent"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#2b8a70"
            fill={`url(#${gradient})`}
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
