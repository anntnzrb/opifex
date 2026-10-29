import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishSnapshot } from "../src/source/snapshot-file.ts";

test("publishes complete snapshots without overwriting and cleans temporary files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opifex-"));
  const path = join(directory, "aa-snapshot-test.json");
  try {
    await publishSnapshot(path, '{"rows":77}');
    expect(await Bun.file(path).text()).toBe('{"rows":77}');
    expect(await readdir(directory)).toEqual(["aa-snapshot-test.json"]);

    let rejection = "";
    try {
      await publishSnapshot(path, '{"rows":1}');
    } catch (cause) {
      rejection = String(cause);
    }
    expect(rejection).toContain("EEXIST");
    expect(await Bun.file(path).text()).toBe('{"rows":77}');
    expect(await readdir(directory)).toEqual(["aa-snapshot-test.json"]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
