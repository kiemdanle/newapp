// apps/admin/src/app/login/page.tsx
import { LoginForm } from './login-form';
import { Logo } from '@/components/logo';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-light/50 p-4 sm:p-6">
      {/* Subtle ambient decorative backdrop circles */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/6 blur-3xl" />

      <div className="relative w-full max-w-[430px] rounded-3xl border border-neutral-200/90 bg-white p-7 sm:p-9 shadow-xl shadow-neutral-900/5 backdrop-blur-xs overflow-hidden">
        {/* Subtle brand top accent bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-primary-dark to-primary" />

        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-light/60 p-2.5 shadow-xs transition-transform hover:scale-105">
            <Logo size={44} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-dark tracking-tight">
              expyrico <span className="font-medium text-neutral-mid">Admin</span>
            </h1>
            <p className="mt-1 text-xs text-neutral-mid">Sign in to access management console</p>
          </div>
        </div>

        {/* Dynamic Multi-Step Form */}
        <LoginForm />

        {/* Security Footer Notice */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-mid/70 border-t border-neutral-100 pt-4">
          <Shield className="h-3 w-3" />
          <span>Encrypted connection & 2FA protected</span>
        </div>
      </div>
    </main>
  );
}
