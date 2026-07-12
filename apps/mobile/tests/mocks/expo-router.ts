export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};
let searchParams: Record<string, string | undefined> = {};
export const useRouter = () => router;
export const useLocalSearchParams = () => searchParams;
export const __setSearchParams = (params: Record<string, string | undefined>) => {
  searchParams = params;
};
export const Link = ({ children }: { children: unknown }) => children as never;
export const Redirect = ({ href }: { href: string }) => {
  router.replace(href);
  return null;
};
export const Stack = Object.assign(({ children }: { children?: unknown }) => children as never, {
  Screen: () => null,
});
export const Tabs = Object.assign(({ children }: { children?: unknown }) => children as never, {
  Screen: () => null,
});
