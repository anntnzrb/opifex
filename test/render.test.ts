import { expect, test } from "bun:test";
import { renderPage } from "../src/ui/render.ts";

test("inserts scripts and data literally while escaping HTML", () => {
  const html = renderPage(
    "__APP__|__DATA__|__DATE__",
    'const price = "$&";',
    { name: "$& <script>" },
    "2026-10-28",
  );
  expect(html).toBe('const price = "$&";|{"name":"$& \\u003cscript>"}|2026-10-28');
  expect(() => renderPage("__APP__ __APP__ __DATA__ __DATE__", "", {}, "")).toThrow(
    "exactly one __APP__",
  );
});
