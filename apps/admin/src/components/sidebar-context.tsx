// apps/admin/src/components/sidebar-context.tsx
'use client';

import * as React from 'react';

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = 'expyrico_admin_sidebar_collapsed';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsedState(stored === 'true');
      }
    } catch {
      // ignore localStorage errors (e.g. private browsing)
    }
  }, []);

  const setIsCollapsed = React.useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleMobile = React.useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      // Prior to hydration mount, default to expanded
      isCollapsed: mounted ? isCollapsed : false,
      toggleSidebar,
      setIsCollapsed,
      isMobileOpen,
      setIsMobileOpen,
      toggleMobile,
    }),
    [isCollapsed, mounted, toggleSidebar, setIsCollapsed, isMobileOpen, toggleMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
