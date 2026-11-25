/** A stand-in for `cloudflare:workers` in unit tests (vitest.config.ts maps the import here): the Durable Object base class. */
export class DurableObject<Env = unknown> {
  constructor(
    protected ctx: DurableObjectState,
    protected env: Env,
  ) {}
}
