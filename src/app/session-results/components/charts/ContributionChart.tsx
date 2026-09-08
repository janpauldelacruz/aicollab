'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const DATA = [
  { name: 'Zara (Coder)', value: 28, color: '#22d3ee' },
  { name: 'Orion (Architect)', value: 24, color: '#60a5fa' },
  { name: 'Mira (PM)', value: 19, color: '#a78bfa' },
  { name: 'Rex (Critic)', value: 17, color: '#f87171' },
  { name: 'Lena (Designer)', value: 12, color: '#f472b6' },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-foreground">{payload[0].name}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: payload[0].payload.color }}>{payload[0].value}%</p>
    </div>
  );
}

export default function ContributionChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
          {DATA.map((entry, i) => (
            <Cell key={`contrib-cell-${i}`} fill={entry.color} fillOpacity={0.85} stroke="var(--card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: 'var(--muted-foreground)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}