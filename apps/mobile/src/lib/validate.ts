import { type ZodTypeAny } from 'zod';

export type FieldErrors = Record<string, string>;

export function fieldErrors<S extends ZodTypeAny>(schema: S, input: unknown): FieldErrors {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const out: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}
