import { allowRefresh } from "./refresh-origin.ts";

const port = Number(Bun.env["PORT"] ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}

const chart = () => new Response(Bun.file("dist/opifex.html"));
let refreshing = false;
// Bun supplies the Request as an immutable host object.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function refresh(request: Request): Promise<Response> {
  if (!allowRefresh(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (refreshing) return new Response("A refresh is already running.", { status: 409 });
  refreshing = true;
  try {
    const refreshProcess = Bun.spawn([process.execPath, "src/refresh.ts"], {
      stdout: "ignore",
      stderr: "inherit",
    });
    if ((await refreshProcess.exited) !== 0)
      return new Response("Refresh failed. The previous chart is still available.", {
        status: 500,
      });
    const buildProcess = Bun.spawn([process.execPath, "src/build.ts"], {
      stdout: "ignore",
      stderr: "inherit",
    });
    if ((await buildProcess.exited) !== 0)
      return new Response("Build failed. The previous chart is still available.", { status: 500 });
    return new Response(Bun.file("dist/opifex.html"), {
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    refreshing = false;
  }
}
const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  idleTimeout: 255,
  routes: {
    "/": chart,
    "/index.html": chart,
    "/refresh": { GET: () => new Response(null, { status: 204 }), POST: refresh },
  },
});
console.log(`Opifex: http://localhost:${server.port}`);
