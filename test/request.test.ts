import { expect, test } from "bun:test";
import { Effect } from "effect";
import { request } from "../src/source/request.ts";

test("retries transient HTTP errors but does not retry client errors", async () => {
  let transient = 0;
  let client = 0;
  const server = Bun.serve({
    port: 0,
    // Bun passes a Request object owned by the server.
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    fetch(req) {
      if (new URL(req.url).pathname === "/transient") {
        transient += 1;
        return transient < 3 ? new Response("busy", { status: 503 }) : new Response("ok");
      }
      client += 1;
      return new Response("missing", { status: 404 });
    },
  });
  try {
    const bytes = await Effect.runPromise(request(`${server.url}transient`));
    expect(new TextDecoder().decode(bytes)).toBe("ok");
    expect(transient).toBe(3);
    const failure = await Effect.runPromise(Effect.flip(request(`${server.url}missing`)));
    expect(failure.message).toContain("HTTP 404");
    expect(client).toBe(1);
  } finally {
    await server.stop(true);
  }
});
