export type AuthDeepLink =
  | { kind: 'reset-password'; token: string }
  | { kind: 'verify-email'; token: string };

export function parseAuthDeepLink(url: string): AuthDeepLink | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'pantry:') return null;
    const path = u.host || u.pathname.replace(/^\//, '');
    const token = u.searchParams.get('token');
    if (!token) return null;
    if (path === 'reset-password') return { kind: 'reset-password', token };
    if (path === 'verify-email') return { kind: 'verify-email', token };
    return null;
  } catch {
    return null;
  }
}
