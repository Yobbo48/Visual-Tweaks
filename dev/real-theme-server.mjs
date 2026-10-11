import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { requireTool } from "./toolchain.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(path.join(root, ".local/real-database"), { recursive: true });
await mkdir(path.join(root, ".local/real-uploads"), { recursive: true });
const cli = path.join(
  path.dirname(requireTool.resolve("@wp-playground/cli")),
  "cli.js",
);
const child = spawn(
  process.execPath,
  [
    cli,
    "server",
    "--port=9411",
    "--site-url=http://127.0.0.1:9411",
    "--php=8.3",
    "--wp=7.1.2",
    "--workers=6",
    `--mount=${root}/visual-tweaks:/wordpress/wp-content/plugins/visual-tweaks`,
    `--mount=${root}/.local/real-theme/kevin-legros:/wordpress/wp-content/themes/kevin-legros`,
    `--mount=${root}/.local/real-uploads:/wordpress/wp-content/uploads`,
    `--mount-before-install=${root}/.local/real-database:/wordpress/wp-content/database`,
    `--blueprint=${root}/dev/real-theme-blueprint.json`,
  ],
  { cwd: root, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
