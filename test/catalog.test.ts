import { expect, test } from "bun:test";
import { manifestFromPage, makeSnapshot } from "../src/source/catalog.ts";
import { parseMethodology, methodologySourceUrl } from "../src/source/methodology.ts";
import { validateMethodology } from "../src/source/schema.ts";

const methodologyHtml = await Bun.file("test/fixtures/aa-methodology-table.html").text();
const fixtureMethodology = parseMethodology(methodologyHtml, {
  url: methodologySourceUrl,
  fetched_at: "2026-10-28T16:00:00Z",
  sha256: "fixture",
});

test("extracts an embedded AA manifest and rejects an unrecognized page", () => {
  const frame = JSON.stringify('1:{"manifest":{"path":"/data/catalog.txt","key":"abcd"}}');
  expect(manifestFromPage(`self.__next_f.push([1,${frame}])`)).toEqual({
    path: "/data/catalog.txt",
    key: "abcd",
  });
  expect(() => manifestFromPage("<html>changed</html>")).toThrow("no recognized catalog manifest");
});

test("rejects a catalog with a malformed scored model", () => {
  expect(() =>
    makeSnapshot(
      { models: [{ frontierCode20: 0.5 }] },
      { url: "https://example.com", fetched_at: "2026-01-01", manifest_sha256: "x" },
      fixtureMethodology,
    ),
  ).toThrow();
  expect(() =>
    makeSnapshot(
      { models: [{ frontierCode20: "broken" }] },
      { url: "https://example.com", fetched_at: "2026-01-01", manifest_sha256: "x" },
      fixtureMethodology,
    ),
  ).toThrow();
});

test("rejects duplicate models and invalid benchmark scores", async () => {
  const { Schema } = await import("effect");
  const { snapshotSchema, validateSnapshot } = await import("../src/source/schema.ts");
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  const first = snapshot.rows[0];
  if (!first) throw new Error("Fixture is empty");
  expect(() => validateSnapshot({ ...snapshot, rows: [first, first] })).toThrow(
    "duplicate model slug",
  );
  expect(() => validateSnapshot({ ...snapshot, rows: [{ ...first, frontierCode20: 2 }] })).toThrow(
    "Invalid benchmark score",
  );
  expect(() => validateSnapshot({ ...snapshot, rows: [{ ...first, cacheHitRate: 1.5 }] })).toThrow(
    "Invalid pricing or cache rate",
  );
});

test("decrypts the authenticated catalog and rejects tampering", async () => {
  const { decodeCatalog } = await import("../src/source/catalog.ts");
  const keyBytes = Uint8Array.fromHex("00112233445566778899aabbccddeeff");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = (await crypto.subtle.digest("SHA-256", keyBytes)).slice(0, 12);
  const compressed = Bun.gzipSync(new TextEncoder().encode('{"models":[{"slug":"test"}]}'));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, compressed);
  expect(await decodeCatalog(cipher, keyBytes.toHex())).toEqual({ models: [{ slug: "test" }] });
  const tampered = new Uint8Array(cipher.slice(0));
  tampered[0] = (tampered[0] ?? 0) ^ 1;
  let rejected = false;
  try {
    await decodeCatalog(tampered.buffer, keyBytes.toHex());
  } catch {
    rejected = true;
  }
  expect(rejected).toBe(true);
  expect(() => decodeCatalog(new ArrayBuffer(0), "11".repeat(17))).toThrow("Invalid catalog key");
});

test("ignores unknown catalog metrics while validating metrics used by the chart", () => {
  const validRow = {
    slug: "model",
    shortName: "Model",
    release: { name: "Model", slug: "model" },
    creator: { name: "Test", color: "#000" },
    isOpenWeights: false,
    releaseDate: null,
    frontierCode20: 0.5,
    terminalBench40: null,
    omniscience: null,
    price1mInputTokens: 1,
    price1mOutputTokens: 1,
    cacheHitPrice: null,
    cacheWritePrice: null,
    cacheHitRate: null,
    medianCanonicalAnswerOutputSpeed: null,
    canonicalEvalTokenCounts: {
      frontierCode20: { input: 100, answer: 20, reasoning: 10, cacheableInput: 0 },
      newlyAddedEvaluation: { upstreamChangedShape: true },
    },
  };
  const source = { url: "https://example.com", fetched_at: "2026-01-01", manifest_sha256: "x" };
  expect(
    makeSnapshot({ models: [validRow] }, source, fixtureMethodology).rows[0]
      ?.canonicalEvalTokenCounts,
  ).toEqual({
    frontierCode20: { input: 100, answer: 20, reasoning: 10, cacheableInput: 0 },
  });
  expect(() =>
    makeSnapshot(
      { models: [{ ...validRow, canonicalEvalTokenCounts: { frontierCode20: { input: -1 } } }] },
      source,
      fixtureMethodology,
    ),
  ).toThrow();
});

test("replays the captured AA page and encrypted catalog offline", async () => {
  const { decodeCatalog } = await import("../src/source/catalog.ts");
  const html = await Bun.file("test/fixtures/aa-page.html").text();
  const manifest = manifestFromPage(html);
  expect(manifest.path).toBe("/data/241a91dd5b5e7b25.txt");
  const catalog = await decodeCatalog(
    await Bun.file("test/fixtures/aa-catalog.bin").arrayBuffer(),
    manifest.key,
  );
  const snapshot = makeSnapshot(
    catalog,
    {
      url: "https://artificialanalysis.ai/evaluations/frontiercode-2-0",
      fetched_at: "2026-10-28T00:00:00Z",
      manifest_sha256: "fixture",
    },
    fixtureMethodology,
  );
  expect(snapshot.rows.length).toBe(77);
  expect(snapshot.rows.find((row) => row.slug === "claude-opus-5-5")?.frontierCode20).toBeCloseTo(
    0.464359595959596,
    10,
  );
});

test("parses all nine task counts and weights from AA methodology", async () => {
  const bytes = await Bun.file("test/fixtures/aa-methodology-table.html").arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const parsed = parseMethodology(methodologyHtml, {
    url: methodologySourceUrl,
    fetched_at: "2026-10-28T16:00:00Z",
    sha256: Buffer.from(digest).toString("hex"),
  });
  expect(parsed.evaluations.frontierCode20).toEqual({ taskCount: 132, indexWeight: 15 });
  expect(parsed.evaluations.terminalBench40).toEqual({ taskCount: 66, indexWeight: 10 });
  expect(parsed.evaluations.omniscience).toEqual({ taskCount: 3000, indexWeight: 15 });
  expect(Object.keys(parsed.evaluations)).toHaveLength(9);
  expect(
    Object.values(parsed.evaluations).reduce((sum, evaluation) => sum + evaluation.indexWeight, 0),
  ).toBe(100);
  expect(parsed.source.sha256).toBe(Buffer.from(digest).toString("hex"));
});

test("fails closed when AA methodology rows or weighting drift", () => {
  const missing = methodologyHtml.replace("FrontierCode 2.0", "FrontierCode X");
  expect(() => parseMethodology(missing, fixtureMethodology.source)).toThrow("missing evaluations");
  const invalid = methodologyHtml.replace("15%</td><td class=", "99%</td><td class=");
  expect(() => parseMethodology(invalid, fixtureMethodology.source)).toThrow("sum to");
});

test("accepts a zero index weight but rejects negative methodology weights", () => {
  const zeroWeight = {
    ...fixtureMethodology,
    evaluations: {
      ...fixtureMethodology.evaluations,
      briefcase: { taskCount: 91, indexWeight: 0 },
      automationBench: { taskCount: 657, indexWeight: 20 },
    },
  };
  expect(validateMethodology(zeroWeight)).toMatchObject({
    evaluations: { briefcase: { taskCount: 91, indexWeight: 0 } },
  });
  expect(() =>
    validateMethodology({
      ...zeroWeight,
      evaluations: {
        ...zeroWeight.evaluations,
        briefcase: { taskCount: 91, indexWeight: -1 },
        automationBench: { taskCount: 657, indexWeight: 21 },
      },
    }),
  ).toThrow("weights must be nonnegative");
});
