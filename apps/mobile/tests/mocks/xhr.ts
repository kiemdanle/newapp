// Controllable XMLHttpRequest stand-in for testing the upload transport.
// Mirrors this repo's existing `tests/mocks/fetch.ts` pattern (replace the
// global, let the test drive responses) rather than relying on React
// Native's own native-networking-backed XHR mock, which isn't scriptable
// deterministically from a test.
type ProgressListener = (event: { lengthComputable: boolean; loaded: number; total: number }) => void;

export class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = [];

  method = '';
  url = '';
  status = 0;
  responseText = '';
  aborted = false;
  sentBody: unknown;
  readonly requestHeaders: Record<string, string> = {};
  readonly upload: { onprogress: ProgressListener | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.requestHeaders[name] = value;
  }

  send(body?: unknown): void {
    this.sentBody = body;
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    this.onabort?.();
  }

  /** Test helper: simulate an upload progress tick. */
  emitProgress(loaded: number, total: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  /** Test helper: simulate a completed response. */
  respond(status: number, body: unknown): void {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }

  /** Test helper: simulate a transport-level network failure. */
  networkError(): void {
    this.onerror?.();
  }
}

/** Installs the fake as the global XMLHttpRequest and resets its instance
 * log. Call in `beforeEach`; read `FakeXMLHttpRequest.instances` afterward
 * to drive/assert on whichever request(s) the code under test issued. */
export function installFakeXhr(): typeof FakeXMLHttpRequest {
  FakeXMLHttpRequest.instances = [];
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXMLHttpRequest;
  return FakeXMLHttpRequest;
}
