import { expect, test } from "bun:test";
import { allowRefresh } from "../src/refresh-origin.ts";

test("allows a same-origin HTTP browser request without Fetch Metadata", () => {
  const request = new Request("http://100.87.13.25:3000/refresh", {
    method: "POST",
    headers: { Origin: "http://100.87.13.25:3000" },
  });
  expect(allowRefresh(request)).toBe(true);
});

test("rejects cross-origin and originless requests", () => {
  const url = "http://100.87.13.25:3000/refresh";
  expect(
    allowRefresh(new Request(url, { method: "POST", headers: { Origin: "https://evil.example" } })),
  ).toBe(false);
  expect(allowRefresh(new Request(url, { method: "POST" }))).toBe(false);
  expect(
    allowRefresh(
      new Request(url, {
        method: "POST",
        headers: { Origin: "http://100.87.13.25:3000", "Sec-Fetch-Site": "cross-site" },
      }),
    ),
  ).toBe(false);
});
