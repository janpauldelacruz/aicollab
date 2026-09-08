'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DATA = [
  { type: 'Code', count: 2, color: '#22d3ee' },
  { type: 'Document', count: 2, color: '#60a5fa' },
  { type: 'Spec', count: 1, color: '#f59e0b' },
  { type: 'Decision', count: 1, color: '#22c55e' },
  { type: 'Diagram', count: 0, color: '#a78bfa' },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: payload[0].payload.color }}>{payload[0].value} artifacts</p>
    </div>
  );
}

export default function ArtifactsByTypeChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="type" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {DATA.map((entry, i) => (
            <Cell key={`artifact-cell-${i}`} fill={entry.color} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}