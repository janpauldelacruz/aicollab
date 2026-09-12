'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { SessionStatusBadge, ModeBadge } from '@/components/ui/StatusBadge';
import type { Session } from './SessionsDashboardClient';

interface Props {
  sessions: Session[];
}

type SortKey = 'name' | 'status' | 'agentCount' | 'messageCount' | 'artifactCount' | 'startedAt';

export default function SessionsTable({ sessions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 8;

  const sorted = [...sessions].sort((a, b) => {
    const av = a[sortKey] as string | number;
    const bv = b[sortKey] as string | number;
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
  });

  const paginated = sorted.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    function setDir(d: 'asc' | 'desc') {
      setSortDir(d);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map((s) => s.id)));
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <Icon
          name={
            sortKey === field
              ? sortDir === 'asc'
                ? 'ChevronUpIcon'
                : 'ChevronDownIcon'
              : 'ChevronUpDownIcon'
          }
          size={12}
          className={sortKey === field ? 'text-primary' : 'text-muted-foreground/50'}
        />
      </span>
    </th>
  );

  return (
    <div className="card-base p-0 overflow-hidden">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20">
          <span className="text-sm text-primary font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              toast.success(`${selectedIds.size} sessions archived`);
              setSelectedIds(new Set());
            }}
            className="btn-secondary text-xs py-1"
          >
            Archive
          </button>
          <button
            onClick={() => {
              toast.error(`${selectedIds.size} sessions deleted`);
              setSelectedIds(new Set());
            }}
            className="btn-danger text-xs py-1"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto btn-ghost text-xs py-1"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded border-border bg-input accent-primary"
                />
              </th>
              <SortHeader label="Session" field="name" />
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Mode
              </th>
              <SortHeader label="Status" field="status" />
              <SortHeader label="Agents" field="agentCount" />
              <SortHeader label="Messages" field="messageCount" />
              <SortHeader label="Artifacts" field="artifactCount" />
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Duration
              </th>
              <SortHeader label="Started" field="startedAt" />
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Icon
                      name="MagnifyingGlassIcon"
                      size={32}
                      className="text-muted-foreground/40"
                    />
                    <p className="text-sm font-medium text-muted-foreground">
                      No sessions match your filters
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Try adjusting the status or mode filter, or clear the search
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((session) => (
                <tr
                  key={session.id}
                  className={`group hover:bg-muted/40 transition-colors ${selectedIds.has(session.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(session.id)}
                      onChange={() => toggleSelect(session.id)}
                      className="w-3.5 h-3.5 rounded border-border bg-input accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[200px]">
                      <p className="text-sm font-medium text-foreground truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {session.topic}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ModeBadge mode={session.mode} />
                  </td>
                  <td className="px-4 py-3">
                    <SessionStatusBadge status={session.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground tabular-nums">
                      {session.agentCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground tabular-nums">
                      {session.messageCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground tabular-nums">
                      {session.artifactCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      {session.duration}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground font-mono">
                      {session.startedAt}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {session.status === 'running' && (
                        <Link
                          href="/live-chatroom"
                          className="btn-ghost p-1.5"
                          title="View live chatroom"
                        >
                          <Icon name="PlayIcon" size={14} className="text-positive" />
                        </Link>
                      )}
                      <Link
                        href={`/session-results?id=${encodeURIComponent(session.id)}`}
                        className="btn-ghost p-1.5"
                        title="View results"
                      >
                        <Icon name="ChartBarIcon" size={14} />
                      </Link>
                      <button
                        onClick={() => toast.info(`Session "${session.name}" archived`)}
                        className="btn-ghost p-1.5"
                        title="Archive session"
                      >
                        <Icon name="ArchiveBoxIcon" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} of{' '}
            {sorted.length} sessions
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-ghost p-1.5 disabled:opacity-40"
            >
              <Icon name="ChevronLeftIcon" size={14} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={`page-${i + 1}`}
                onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  page === i + 1
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn-ghost p-1.5 disabled:opacity-40"
            >
              <Icon name="ChevronRightIcon" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
