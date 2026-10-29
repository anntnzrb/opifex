import { Predicate, Schema } from "effect";
import { snapshotSchema, validateSnapshot, type Methodology } from "./schema.ts";

const optionalNumber = Schema.optionalKey(Schema.NullOr(Schema.Finite));
const rawTokens = Schema.Struct({
  input: Schema.Finite,
  answer: optionalNumber,
  reasoning: optionalNumber,
  cacheableInput: optionalNumber,
});
const rawRow = Schema.Struct({
  slug: Schema.String,
  shortName: Schema.String,
  release: Schema.Struct({ name: Schema.String, slug: Schema.String }),
  creator: Schema.Struct({ name: Schema.String, color: Schema.String }),
  isOpenWeights: Schema.Boolean,
  releaseDate: Schema.optionalKey(Schema.NullOr(Schema.String)),
  frontierCode20: Schema.Finite,
  terminalBench40: optionalNumber,
  omniscience: optionalNumber,
  price1mInputTokens: optionalNumber,
  price1mOutputTokens: optionalNumber,
  cacheHitPrice: optionalNumber,
  cacheWritePrice: optionalNumber,
  cacheHitRate: optionalNumber,
  medianCanonicalAnswerOutputSpeed: optionalNumber,
  canonicalEvalTokenCounts: Schema.optionalKey(
    Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  ),
});
const catalogSchema = Schema.Struct({ models: Schema.Array(Schema.Unknown) });
const relevantEvaluations = new Set([
  "briefcase",
  "automationBench",
  "gdpPdf",
  "frontierCode20",
  "terminalBench40",
  "terminalBenchScience",
  "critptAgenticHard",
  "omniscience",
  "hleDiamond",
]);

export function manifestFromPage(html: string): { readonly path: string; readonly key: string } {
  const scripts = html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/gu);
  for (const script of scripts) {
    if (script[1] === undefined) continue;
    const frame: unknown = JSON.parse(script[1]);
    if (typeof frame !== "string") continue;
    const match = /"manifest":\{"path":"([^"\\]+)","key":"([0-9a-f]+)"\}/u.exec(frame);
    if (match?.[1] !== undefined && match[2] !== undefined)
      return { path: match[1], key: match[2] };
  }
  throw new Error("AA page contains no recognized catalog manifest");
}

// Web Crypto consumes an ArrayBuffer; it does not mutate the input.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
export async function decodeCatalog(bytes: ArrayBuffer, keyHex: string): Promise<unknown> {
  if (!/^(?:[0-9a-f]{32}|[0-9a-f]{48}|[0-9a-f]{64})$/u.test(keyHex))
    throw new Error("Invalid catalog key");
  const key = Uint8Array.fromHex(keyHex);
  const iv = (await crypto.subtle.digest("SHA-256", key)).slice(0, 12);
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, bytes);
  return JSON.parse(new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(plain)))) as unknown;
}

export function makeSnapshot(
  catalog: unknown,
  source: { readonly url: string; readonly fetched_at: string; readonly manifest_sha256: string },
  methodology: Methodology,
) {
  const models = Schema.decodeUnknownSync(catalogSchema)(catalog).models;
  const rows = [];
  for (const model of models) {
    if (!Predicate.isObject(model)) throw new Error("Catalog contains an invalid model");
    if (model["frontierCode20"] === null || model["frontierCode20"] === undefined) continue;
    const row = Schema.decodeUnknownSync(rawRow)(model);
    const counts: Record<
      string,
      {
        input: number;
        answer: number | null;
        reasoning: number | null;
        cacheableInput: number | null;
      }
    > = {};
    for (const [key, rawValue] of Object.entries(row.canonicalEvalTokenCounts ?? {})) {
      if (!relevantEvaluations.has(key)) continue;
      const value = Schema.decodeUnknownSync(rawTokens)(rawValue);
      counts[key] = {
        input: value.input,
        answer: value.answer ?? null,
        reasoning: value.reasoning ?? null,
        cacheableInput: value.cacheableInput ?? null,
      };
    }
    rows.push({
      ...row,
      releaseDate: row.releaseDate ?? null,
      terminalBench40: row.terminalBench40 ?? null,
      omniscience: row.omniscience ?? null,
      price1mInputTokens: row.price1mInputTokens ?? null,
      price1mOutputTokens: row.price1mOutputTokens ?? null,
      cacheHitPrice: row.cacheHitPrice ?? null,
      cacheWritePrice: row.cacheWritePrice ?? null,
      cacheHitRate: row.cacheHitRate ?? null,
      medianCanonicalAnswerOutputSpeed: row.medianCanonicalAnswerOutputSpeed ?? null,
      canonicalEvalTokenCounts: counts,
    });
  }
  if (rows.length === 0) throw new Error("Catalog has no FrontierCode scores");
  return validateSnapshot(Schema.decodeSync(snapshotSchema)({ source, methodology, rows }));
}
