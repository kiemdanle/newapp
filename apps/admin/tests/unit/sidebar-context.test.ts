import { describe, expect, it, beforeEach } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { SidebarProvider, useSidebar } from '@/components/sidebar-context';

describe('SidebarContext', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  it('renders SidebarProvider children properly', () => {
    function Child() {
      const { isCollapsed } = useSidebar();
      return React.createElement('div', { id: 'test-child' }, isCollapsed ? 'collapsed' : 'expanded');
    }

    const html = renderToString(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(Child)
      )
    );

    expect(html).toContain('expanded');
  });

  it('throws error when useSidebar is used outside of SidebarProvider', () => {
    function OrphanChild() {
      useSidebar();
      return null;
    }

    expect(() => {
      renderToString(React.createElement(OrphanChild));
    }).toThrow('useSidebar must be used within a SidebarProvider');
  });
});
