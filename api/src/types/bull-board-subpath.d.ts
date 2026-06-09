// bull-board v5 ships JS + d.ts for this subpath but predates the package "exports"
// map, so NodeNext resolution can't locate the types. Declare the subpath so the
// runtime import resolves; the concrete adapter type is unified at the call site.
declare module '@bull-board/api/bullMQAdapter' {
  export class BullMQAdapter {
    constructor(queue: unknown, options?: Record<string, unknown>);
  }
}
