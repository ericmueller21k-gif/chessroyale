// The few parts of the `ws` package the residents use (it ships no types, and @types/ws isn't a dependency).
declare module "ws" {
  export default class WebSocket {
    static readonly OPEN: number;
    readonly readyState: number;
    constructor(url: string, opts?: { headers?: Record<string, string> });
    on(event: "open", fn: () => void): this;
    on(event: "message", fn: (data: unknown) => void): this;
    on(event: "close", fn: (code: number) => void): this;
    on(event: "error", fn: (e: Error) => void): this;
    on(event: "unexpected-response", fn: (req: unknown, res: { statusCode?: number }) => void): this;
    send(data: string): void;
    close(): void;
    terminate(): void;
  }
}
