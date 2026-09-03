import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { KpiCard } from '@/components/kpi-card';
import { Activity, Users, Package } from 'lucide-react';

describe('KpiCard', () => {
  it('renders complete full title without truncate class', () => {
    const html = renderToString(
      React.createElement(KpiCard, {
        label: 'Active Users (7d)',
        value: '1,234',
        icon: Activity,
        sub: 'Active past 7 days',
      })
    );

    // Verifies full title is present
    expect(html).toContain('Active Users (7d)');
    // Verifies accessibility title attribute matches label
    expect(html).toContain('title="Active Users (7d)"');
    // Verifies truncate class is NOT applied to the title
    expect(html).not.toMatch(/text-xs[^"]*truncate/);
    // Verifies value and subtitle are rendered
    expect(html).toContain('1,234');
    expect(html).toContain('Active past 7 days');
  });

  it('renders trend badge with correct styling tokens', () => {
    const htmlTrendUp = renderToString(
      React.createElement(KpiCard, {
        label: 'Active Users (7d)',
        value: '42',
        icon: Users,
        trend: '15% of total',
        trendUp: true,
        sub: 'Past 7 days',
      })
    );

    expect(htmlTrendUp).toContain('15% of total');
    expect(htmlTrendUp).toContain('bg-primary-light/50');
    expect(htmlTrendUp).toContain('text-primary-dark');

    const htmlTrendDown = renderToString(
      React.createElement(KpiCard, {
        label: 'Loss Rate',
        value: '5%',
        trend: '-2% vs last month',
        trendUp: false,
      })
    );

    expect(htmlTrendDown).toContain('-2% vs last month');
    expect(htmlTrendDown).toContain('text-destructive');
  });

  it('renders gracefully when optional props (icon, trend, sub) are omitted', () => {
    const htmlMinimal = renderToString(
      React.createElement(KpiCard, {
        label: 'Product Reviews',
        value: 88,
      })
    );

    expect(htmlMinimal).toContain('Product Reviews');
    expect(htmlMinimal).toContain('88');
    expect(htmlMinimal).toContain('tabular-nums');
  });
});
