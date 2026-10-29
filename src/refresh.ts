import { Effect, Schema } from "effect";
import { mkdir } from "node:fs/promises";
import { request } from "./source/request.ts";
import { decodeCatalog, makeSnapshot, manifestFromPage } from "./source/catalog.ts";
import { points } from "./core/points.ts";
import { rules } from "./core/rules.ts";
import { methodologySourceUrl, parseMethodology } from "./source/methodology.ts";
import { snapshotSchema, validateSnapshot } from "./source/schema.ts";
import { assertMinimumScoredPopulation } from "./source/population.ts";
import { publishSnapshot } from "./source/snapshot-file.ts";

const source = "https://artificialanalysis.ai/evaluations/frontiercode-2-0";
class RefreshError extends Schema.TaggedError<RefreshError, { readonly brand: unique symbol }>()(
  "RefreshError",
  {
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}
// AbortSignal is a host API object passed through to fetch.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
const attempt = <A>(message: string, f: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({ try: f, catch: (cause) => new RefreshError({ message, cause }) });
// Web Crypto consumes an ArrayBuffer without mutating it.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function parseMethodologyBytes(bytes: ArrayBuffer, fetched_at: string) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return parseMethodology(new TextDecoder().decode(bytes), {
    url: methodologySourceUrl,
    fetched_at,
    sha256: Buffer.from(digest).toString("hex"),
  });
}
const download = Effect.gen(function* () {
  const page = yield* request(source);
  const html = new TextDecoder().decode(page);
  const manifest = yield* Effect.try({
    try: () => manifestFromPage(html),
    catch: (cause) => new RefreshError({ message: "Could not find AA catalog", cause }),
  });
  const url = new URL(manifest.path, source);
  if (
    url.origin !== new URL(source).origin ||
    url.protocol !== "https:" ||
    url.username ||
    url.password
  )
    return yield* new RefreshError({
      message: "Catalog URL is not on AA's HTTPS origin",
      cause: manifest.path,
    });
  const bytes = yield* request(url.href);
  const catalog = yield* attempt("Could not decrypt AA catalog", () =>
    decodeCatalog(bytes, manifest.key),
  );
  const hash = yield* attempt("Could not hash AA catalog", () =>
    crypto.subtle.digest("SHA-256", bytes),
  );
  const methodologyBytes = yield* request(methodologySourceUrl);
  const fetched_at = new Date().toISOString();
  const methodology = yield* attempt("AA methodology did not match expected table", () =>
    parseMethodologyBytes(methodologyBytes, fetched_at),
  );
  const snapshot = yield* Effect.try({
    try: () =>
      makeSnapshot(
        catalog,
        {
          url: source,
          fetched_at,
          manifest_sha256: Buffer.from(hash).toString("hex"),
        },
        methodology,
      ),
    catch: (cause) =>
      new RefreshError({ message: "AA catalog did not match expected schema", cause }),
  });
  return snapshot;
});
const program = Effect.gen(function* () {
  const checkOnly = Bun.argv.includes("--check");
  const snapshot = yield* download;
  if (points(snapshot).length === 0)
    return yield* new RefreshError({
      message: "Catalog contains no plottable models",
      cause: null,
    });
  const previous = yield* attempt("Could not read the last saved snapshot", async () => {
    await mkdir("data", { recursive: true });
    const files = (
      await Array.fromAsync(new Bun.Glob("aa-snapshot-*.json").scan("data"))
    ).toSorted();
    const latest = files.at(-1);
    if (latest === undefined) return null;
    const raw: unknown = await Bun.file(`data/${latest}`).json();
    return validateSnapshot(Schema.decodeUnknownSync(snapshotSchema)(raw));
  });
  if (previous !== null) {
    yield* Effect.try({
      try: () => {
        assertMinimumScoredPopulation(
          snapshot.rows.length,
          previous.rows.length,
          rules.minimumScoredPopulationRatio,
        );
      },
      catch: (cause) =>
        new RefreshError({ message: "AA scored model population dropped unexpectedly", cause }),
    });
  }
  if (checkOnly) {
    console.log(
      `Live check passed for ${snapshot.rows.length} scored models; no snapshot written.`,
    );
    return null;
  }
  const path = `data/aa-snapshot-${snapshot.source.fetched_at.replaceAll(":", "-")}.json`;
  yield* attempt("Could not write snapshot", () => publishSnapshot(path, JSON.stringify(snapshot)));
  console.log(`Saved ${snapshot.rows.length} configurations to ${path}`);
  return path;
});
await Effect.runPromise(program);
