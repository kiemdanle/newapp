export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};
export const useRouter = () => router;
export const useLocalSearchParams = () => ({});
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
