// apps/admin/src/components/sidebar.tsx
import Link from 'next/link';
import { NAV } from '@/lib/nav';

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r bg-card">
      <nav className="flex flex-col gap-1 p-3 text-sm">
        {NAV.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
              {section.title}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href as never}
                className="block rounded px-2 py-1.5 hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
