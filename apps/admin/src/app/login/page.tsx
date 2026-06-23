// apps/admin/src/app/login/page.tsx
import { LoginForm } from './login-form';
import { Logo } from '@/components/logo';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo size={56} />
          <h1 className="text-[24px] font-semibold text-neutral-dark font-display leading-none">
            expyrico <span className="text-neutral-mid font-medium">Admin</span>
          </h1>
        </div>
        <p className="mb-6 text-sm text-neutral-mid">Sign in to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
