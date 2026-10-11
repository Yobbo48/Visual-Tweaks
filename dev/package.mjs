import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir("artifacts", { recursive: true });
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const archive = `artifacts/visual-tweaks-${version}.zip`;
const result = spawnSync("zip", ["-r", "-FS", archive, "visual-tweaks"], {
  encoding: "utf8",
});
if (result.status) throw new Error(result.stderr);
console.log(archive);
