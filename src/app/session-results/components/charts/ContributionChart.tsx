'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { contributionByAgent } from '@/lib/session/sessionStore';
import type { StoredSession } from '@/lib/session/sessionStore';

interface Props {
  session: StoredSession;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-foreground">{payload[0].name}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: payload[0].payload.color }}>
        {payload[0].value}%
      </p>
    </div>
  );
}

export default function ContributionChart({ session }: Props) {
  const DATA = contributionByAgent(session)
    .filter((a) => a.messages > 0)
    .map((a) => ({ name: `${a.name} (${a.role})`, value: a.contribution, color: a.color }));

  if (DATA.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
        No messages recorded yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={DATA}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {DATA.map((entry, i) => (
            <Cell
              key={`contrib-cell-${i}`}
              fill={entry.color}
              fillOpacity={0.85}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', color: 'var(--muted-foreground)' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
