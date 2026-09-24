'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useOnboarding } from '@/components/OnboardingTour';

interface TopbarProps {
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
}

export default function Topbar({ onMenuToggle, onSidebarToggle, sidebarCollapsed }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 flex-shrink-0 z-30">
      {/* Mobile menu */}
      <button onClick={onMenuToggle} className="btn-ghost p-1.5 lg:hidden">
        <Icon name="Bars3Icon" size={20} />
      </button>

      {/* Desktop sidebar toggle */}
      <button onClick={onSidebarToggle} className="btn-ghost p-1.5 hidden lg:flex" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Icon name={sidebarCollapsed ? 'ChevronDoubleRightIcon' : 'ChevronDoubleLeftIcon'} size={16} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-input border border-border text-muted-foreground text-sm cursor-pointer hover:border-ring transition-colors">
        <Icon name="MagnifyingGlassIcon" size={14} />
        <span className="text-xs">Search sessions, agents…</span>
        <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* New session quick action */}
        <Link href="/session-setup" className="btn-primary hidden sm:inline-flex text-xs px-3 py-1.5">
          <Icon name="PlusIcon" size={14} />
          New Session
        </Link>

        {/* Tour button */}
        <TourButton />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="btn-ghost p-1.5 relative"
          >
            <Icon name="BellIcon" size={18} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">Notifications</span>
                <span className="text-xs text-primary cursor-pointer hover:underline">Mark all read</span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {[
                  { id: 'notif-1', icon: 'CheckCircleIcon', text: 'Session "SaaS MVP Build" completed', time: '2m ago', color: 'text-positive' },
                  { id: 'notif-2', icon: 'ExclamationTriangleIcon', text: 'Agent "Critic-7" stalled in debate loop', time: '18m ago', color: 'text-warning' },
                  { id: 'notif-3', icon: 'DocumentTextIcon', text: '3 new artifacts generated in "API Design"', time: '1h ago', color: 'text-accent' },
                ].map((n) => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer">
                    <Icon name={n.icon as any} size={16} className={`mt-0.5 flex-shrink-0 ${n.color}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">{n.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
          <span className="text-xs font-semibold text-primary">JL</span>
        </div>
      </div>
    </header>
  );
}

function TourButton() {
  const { start, isActive } = useOnboarding();
  if (isActive) return null;
  return (
    <button
      onClick={start}
      title="Start guided tour"
      className="btn-ghost p-1.5 hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Icon name="QuestionMarkCircleIcon" size={18} />
    </button>
  );
}