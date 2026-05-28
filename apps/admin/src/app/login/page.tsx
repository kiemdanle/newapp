// apps/admin/src/app/login/page.tsx
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Pantry Admin</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
