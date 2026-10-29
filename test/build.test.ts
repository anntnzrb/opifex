import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

async function runBuild(setup: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "opifex-build-"));
  await cp(join(root, "src"), join(directory, "src"), { recursive: true });
  await cp(join(root, "config"), join(directory, "config"), { recursive: true });
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), "dir");
  await mkdir(join(directory, "data"));
  await cp(
    join(root, "test/fixtures/aa-snapshot-2026-10-28.json"),
    join(directory, "data/aa-snapshot-2026-10-28.json"),
  );
  await mkdir(join(directory, "dist"));
  await writeFile(join(directory, "dist/opifex.html"), "Existing chart\n");
  await writeFile(join(directory, "dist/elbows.md"), "Existing table\n");
  await setup(directory);
  const child = Bun.spawn([process.execPath, "run", join(directory, "src/build.ts")], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const error = await new Response(child.stderr).text();
  return { directory, error, exitCode: await child.exited };
}

test("build writes the chart and the elbow table from the newest snapshot", async () => {
  const { directory, exitCode } = await runBuild(async () => {});
  try {
    expect(exitCode).toBe(0);
    expect(await readFile(join(directory, "dist/opifex.html"), "utf8")).toContain("2026-10-28");
    const elbows = await readFile(join(directory, "dist/elbows.md"), "utf8");
    expect(elbows).toContain("from the 2026-10-28 snapshot");
    expect(elbows).toContain("| Creator | Model |");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a failed build leaves both existing outputs unchanged", async () => {
  const { directory, error, exitCode } = await runBuild(async (sandbox) => {
    await writeFile(join(sandbox, "data/aa-snapshot-2099-01-01.json"), "{}\n");
  });
  try {
    expect(exitCode).not.toBe(0);
    expect(error).not.toBe("");
    expect(await readFile(join(directory, "dist/opifex.html"), "utf8")).toBe("Existing chart\n");
    expect(await readFile(join(directory, "dist/elbows.md"), "utf8")).toBe("Existing table\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
