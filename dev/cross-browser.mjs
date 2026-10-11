import { spawnSync } from "node:child_process";
const file = process.argv.includes("--comfort-real-theme")
  ? "tests/comfort-real-theme-e2e.mjs"
  : process.argv.includes("--comfort")
    ? "tests/comfort-e2e.mjs"
    : process.argv.includes("--stability")
      ? "tests/stability-e2e.mjs"
      : process.argv.includes("--speed")
        ? "tests/speed-e2e.mjs"
        : process.argv.includes("--polish")
          ? "tests/polish-e2e.mjs"
          : process.argv.includes("--real-theme")
            ? "tests/real-theme-e2e.mjs"
            : process.argv.includes("--ergonomics")
              ? "tests/ergonomics-e2e.mjs"
              : "tests/viewport-e2e.mjs";
for (const engine of ["chromium", "webkit", "firefox"]) {
  const result = spawnSync(process.execPath, [file], {
    stdio: "inherit",
    env: { ...process.env, VT_ENGINE: engine },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
