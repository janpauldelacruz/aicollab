'use client';
import React, { useCallback } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { listSessions } from '@/lib/session/sessionStore';
import { useLiveData } from '@/lib/session/useLiveData';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Sessions', href: '/sessions-dashboard', icon: 'LayoutDashboardIcon', group: 'main' },
  { label: 'Live Chatroom', href: '/live-chatroom', icon: 'MessageSquareIcon', group: 'main' },
  { label: 'New Session', href: '/session-setup', icon: 'PlusCircleIcon', group: 'main' },
  { label: 'Agent Templates', href: '/agent-templates', icon: 'CpuIcon', group: 'library' },
  { label: 'Session Results', href: '/session-results', icon: 'BarChart2Icon', group: 'library' },
  {
    label: 'Past Collaborations',
    href: '/past-collaborations',
    icon: 'ClockIcon',
    group: 'library',
  },
  { label: 'Share Session', href: '/share-session', icon: 'ShareIcon', group: 'library' },
  { label: 'API Keys', href: '/api-keys', icon: 'KeyIcon', group: 'account' },
  { label: 'Account Settings', href: '/account-settings', icon: 'SettingsIcon', group: 'account' },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeRoute?: string;
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
  activeRoute,
}: SidebarProps) {
  // Badge the chatroom with sessions that are genuinely still live, not a constant.
  const readLiveCount = useCallback(() => {
    const FRESH_MS = 5 * 60 * 1000;
    return listSessions().filter(
      (s) =>
        (s.status === 'running' || s.status === 'paused') &&
        Date.now() - new Date(s.updatedAt).getTime() < FRESH_MS
    ).length;
  }, []);
  const [liveCount] = useLiveData<number>(readLiveCount, 0);
  const { user, signOut } = useAuth();

  const email: string | undefined = user?.email;
  const displayName: string =
    user?.user_metadata?.full_name || email?.split('@')[0] || 'Local user';
  const initials = displayName
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('');

  const withBadges = NAV_ITEMS.map((item) =>
    item.href === '/live-chatroom' && liveCount > 0 ? { ...item, badge: liveCount } : item
  );

  const mainItems = withBadges.filter((i) => i.group === 'main');
  const libraryItems = withBadges.filter((i) => i.group === 'library');
  const accountItems = withBadges.filter((i) => i.group === 'account');

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = activeRoute === item.href;
    return (
      <Link
        href={item.href}
        onClick={onMobileClose}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <Icon name={item.icon as any} size={18} className="flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
            {item.badge}
          </span>
        )}
        {collapsed && item.badge && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
        )}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-card border border-border rounded-md text-xs font-medium text-foreground opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-card border-r border-border sidebar-transition flex-shrink-0 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center h-14 border-b border-border px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}
        >
          <AppLogo size={28} />
          {!collapsed && (
            <span className="font-semibold text-base text-foreground tracking-tight">AICollab</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {!collapsed && (
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Workspace
            </p>
          )}
          {mainItems.map((item) => (
            <NavLink key={`nav-${item.href}`} item={item} />
          ))}

          <div className={`my-3 border-t border-border ${collapsed ? 'mx-1' : 'mx-0'}`} />

          {!collapsed && (
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Library
            </p>
          )}
          {libraryItems.map((item) => (
            <NavLink key={`nav-${item.href}`} item={item} />
          ))}

          <div className={`my-3 border-t border-border ${collapsed ? 'mx-1' : 'mx-0'}`} />

          {accountItems.map((item) => (
            <NavLink key={`nav-${item.href}`} item={item} />
          ))}
        </nav>

        {/* Bottom user section */}
        <div
          className={`border-t border-border p-2 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}
        >
          {collapsed ? (
            <div
              className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"
              title={displayName}
            >
              <span className="text-xs font-semibold text-primary">{initials || 'U'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">{initials || 'U'}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {email ?? (isSupabaseConfigured ? 'Signed out' : 'Local install')}
                </p>
              </div>
              {user && (
                <button
                  onClick={() => signOut()}
                  title="Sign out"
                  className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                >
                  <Icon name="ArrowRightOnRectangleIcon" size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 border-b border-border px-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <span className="font-semibold text-base text-foreground">AICollab</span>
          </div>
          <button onClick={onMobileClose} className="btn-ghost p-1.5">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Workspace
          </p>
          {mainItems.map((item) => (
            <NavLink key={`mobile-nav-${item.href}`} item={item} />
          ))}
          <div className="my-3 border-t border-border" />
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Library
          </p>
          {libraryItems.map((item) => (
            <NavLink key={`mobile-nav-lib-${item.href}`} item={item} />
          ))}

          <div className={`my-3 border-t border-border ${collapsed ? 'mx-1' : 'mx-0'}`} />

          {accountItems.map((item) => (
            <NavLink key={`mobile-nav-acc-${item.href}`} item={item} />
          ))}
        </nav>
      </aside>
    </>
  );
}
