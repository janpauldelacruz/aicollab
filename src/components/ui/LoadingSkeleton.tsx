import React from 'react';

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-md ${className}`} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card-base space-y-3 ${className}`}>
      <SkeletonLine className="h-4 w-2/3" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="h-3 w-3/4" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={`skel-col-${i}`} className="px-4 py-3">
          <SkeletonLine className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonMessageBubble({ align = 'left' }: { align?: 'left' | 'right' }) {
  return (
    <div className={`flex gap-3 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full shimmer flex-shrink-0" />
      <div className="space-y-2 flex-1 max-w-xs">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}
