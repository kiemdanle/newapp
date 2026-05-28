export type Paginated<T> = {
  items: T[];
  cursor: string | null;
  total?: number;
};
