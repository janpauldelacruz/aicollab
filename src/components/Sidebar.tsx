'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Sessions', href: '/sessions-dashboard', icon: 'LayoutDashboardIcon', group: 'main' },
  { label: 'Live Chatroom', href: '/live-chatroom', icon: 'MessageSquareIcon', badge: 1, group: 'main' },
  { label: 'New Session', href: '/session-setup', icon: 'PlusCircleIcon', group: 'main' },
  { label: 'Agent Templates', href: '/agent-templates', icon: 'CpuIcon', group: 'library' },
  { label: 'Session Results', href: '/session-results', icon: 'BarChart2Icon', group: 'library' },
  { label: 'Past Collaborations', href: '/past-collaborations', icon: 'ClockIcon', group: 'library' },
  { label: 'Share Session', href: '/share-session', icon: 'ShareIcon', group: 'library' },
  { label: 'Account Settings', href: '/account-settings', icon: 'SettingsIcon', group: 'account' },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeRoute?: string;
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, activeRoute }: SidebarProps) {
  const mainItems = NAV_ITEMS.filter((i) => i.group === 'main');
  const libraryItems = NAV_ITEMS.filter((i) => i.group === 'library');
  const accountItems = NAV_ITEMS.filter((i) => i.group === 'account');

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = activeRoute === item.href;
    return (
      <Link
        href={item.href}
        onClick={onMobileClose}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-primary/10 text-primary border border-primary/20' :'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <Icon name={item.icon as any} size={18} className="flex-shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
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
        <div className={`flex items-center h-14 border-b border-border px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
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
        <div className={`border-t border-border p-2 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">JL</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">JL</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">Jamie Lin</p>
                <p className="text-xs text-muted-foreground truncate">Pro Plan</p>
              </div>
              <Icon name="ChevronUpDownIcon" size={14} className="ml-auto text-muted-foreground flex-shrink-0" />
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
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Workspace</p>
          {mainItems.map((item) => (
            <NavLink key={`mobile-nav-${item.href}`} item={item} />
          ))}
          <div className="my-3 border-t border-border" />
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Library</p>
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