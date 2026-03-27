'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface CompletionDonutProps {
  value: number;
  size?: number;
  className?: string;
}

export function CompletionDonut({ value, size = 64, className }: CompletionDonutProps) {
  const data = [
    { name: 'complete', value },
    { name: 'remaining', value: 100 - value },
  ];

  return (
    <div className={className} style={{ width: size, height: size, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.3}
            outerRadius={size * 0.45}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill="#10b981" />
            <Cell fill="#27272a" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-zinc-200"
        style={{ fontSize: size * 0.2 }}
      >
        {value}%
      </span>
    </div>
  );
}
