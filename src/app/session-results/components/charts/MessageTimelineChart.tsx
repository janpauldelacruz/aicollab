'use client';
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DATA = [
  { time: '0:00', messages: 2 },
  { time: '0:05', messages: 5 },
  { time: '0:10', messages: 8 },
  { time: '0:15', messages: 4 },
  { time: '0:20', messages: 11 },
  { time: '0:25', messages: 7 },
  { time: '0:30', messages: 13 },
  { time: '0:35', messages: 9 },
  { time: '0:40', messages: 15 },
  { time: '0:45', messages: 6 },
  { time: '0:50', messages: 10 },
  { time: '0:55', messages: 12 },
  { time: '1:00', messages: 8 },
  { time: '1:05', messages: 14 },
  { time: '1:10', messages: 5 },
  { time: '1:15', messages: 9 },
  { time: '1:20', messages: 3 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-primary tabular-nums">{payload[0].value} messages</p>
    </div>
  );
}

export default function MessageTimelineChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="messages" stroke="var(--primary)" strokeWidth={2} fill="url(#timeline-grad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}