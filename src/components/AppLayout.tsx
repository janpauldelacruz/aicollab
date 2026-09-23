'use client';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ResumeSessionBar from './ResumeSessionBar';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute?: string;
}

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        activeRoute={activeRoute}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar
          onMenuToggle={() => setMobileSidebarOpen(true)}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <ResumeSessionBar activeRoute={activeRoute} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 2xl:px-10 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}