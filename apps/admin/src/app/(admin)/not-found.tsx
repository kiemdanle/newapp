import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="rounded-3xl border border-border bg-card p-8 sm:p-10 max-w-lg shadow-card space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-mid shadow-xs border border-border">
          <FileQuestion size={28} className="text-neutral-mid" />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-mid font-body">
            404 Not Found
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-dark font-display">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-neutral-mid leading-relaxed font-body">
            The requested page does not exist or you do not have permission to access it.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild variant="default" className="rounded-xl shadow-xs gap-2">
            <Link href="/">
              <ArrowLeft size={16} />
              <span>Return to Dashboard</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
