// apps/admin/src/components/header.tsx
export function Header({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="text-sm font-semibold">Pantry Admin</div>
      <div className="text-sm text-muted-foreground">{email}</div>
    </header>
  );
}
