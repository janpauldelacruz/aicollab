'use client';
import React from 'react';

const NODES = [
  { id: 'node-pm', x: 50, y: 30, label: 'PM', color: '#7c3aed', size: 44, delay: '0s' },
  { id: 'node-coder', x: 20, y: 65, label: 'Coder', color: '#06b6d4', size: 36, delay: '1s' },
  { id: 'node-designer', x: 80, y: 65, label: 'Designer', color: '#ec4899', size: 36, delay: '2s' },
  {
    id: 'node-researcher',
    x: 35,
    y: 85,
    label: 'Research',
    color: '#22c55e',
    size: 28,
    delay: '0.5s',
  },
  { id: 'node-critic', x: 65, y: 85, label: 'Critic', color: '#ef4444', size: 28, delay: '1.5s' },
];

const EDGES = [
  { id: 'edge-pm-coder', x1: 50, y1: 30, x2: 20, y2: 65 },
  { id: 'edge-pm-designer', x1: 50, y1: 30, x2: 80, y2: 65 },
  { id: 'edge-coder-researcher', x1: 20, y1: 65, x2: 35, y2: 85 },
  { id: 'edge-designer-critic', x1: 80, y1: 65, x2: 65, y2: 85 },
  { id: 'edge-coder-designer', x1: 20, y1: 65, x2: 80, y2: 65 },
  { id: 'edge-researcher-critic', x1: 35, y1: 85, x2: 65, y2: 85 },
];

export default function AgentNetworkViz() {
  return (
    <div className="w-64 h-64 relative">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <radialGradient id="glow-pm" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-accent" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <ellipse cx="50" cy="60" rx="40" ry="35" fill="url(#glow-pm)" />

        {/* Edges */}
        {EDGES?.map((e) => (
          <line
            key={e?.id}
            x1={e?.x1}
            y1={e?.y1}
            x2={e?.x2}
            y2={e?.y2}
            stroke="#a78bfa"
            strokeWidth="0.4"
            strokeOpacity="0.35"
            strokeDasharray="2 2"
          />
        ))}

        {/* Nodes */}
        {NODES?.map((n) => (
          <g
            key={n?.id}
            style={{
              animation: `node-float ${n?.size > 40 ? '6s' : '8s'} ease-in-out infinite`,
              animationDelay: n?.delay,
            }}
          >
            <circle cx={n?.x} cy={n?.y} r={n?.size / 10 + 2} fill={n?.color} fillOpacity="0.15" />
            <circle cx={n?.x} cy={n?.y} r={n?.size / 10} fill={n?.color} fillOpacity="0.9" />
            <text
              x={n?.x}
              y={n?.y + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={n?.size > 40 ? '3.5' : '2.8'}
              fontWeight="600"
            >
              {n?.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
