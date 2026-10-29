import { randomUUID } from "node:crypto";
import { link, rm, writeFile } from "node:fs/promises";

export async function publishSnapshot(path: string, contents: string): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { flag: "wx" });
    await link(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
