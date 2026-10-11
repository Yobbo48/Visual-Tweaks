import { spawnSync } from "node:child_process";

// Run serially: WordPress refreshes the account nonce/session on login.
const run = (file, args = [], env = {}) => {
  console.log(`RUN ${file} ${args.join(" ")} ${env.VT_ENGINE || ""}`);
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status || 1);
};
run("dev/check.mjs");
run("--test", ["tests/core.test.mjs"]);
// 0.4.4 : rendu serveur (toutes les propriétés) et caches après publication.
run("--test", ["tests/published-styles.test.mjs", "tests/cache.test.mjs"]);
for (const suite of ["stability", "width", "save", "foundations", "e2e", "ux"])
  run(`tests/${suite === "e2e" ? "e2e" : suite + "-e2e"}.mjs`);
for (const engine of ["chromium", "webkit", "firefox"]) {
  if (engine !== "chromium")
    run("tests/stability-e2e.mjs", [], { VT_ENGINE: engine });
  for (const suite of [
    "ergonomics",
    "viewport",
    "speed",
    "polish",
    "real-theme",
    "comfort",
  ])
    run(`tests/${suite}-e2e.mjs`, [], { VT_ENGINE: engine });
}

run("dev/cross-browser.mjs", ["--comfort-real-theme"]);

// Additive stabilization coverage: all 270 reference checks above remain intact.
for (const engine of ["chromium", "webkit", "firefox"]) {
  run("tests/guard-visibility-e2e.mjs", [], { VT_ENGINE: engine });
  run("tests/stabilisation-e2e.mjs", [], { VT_ENGINE: engine });
}
run("tests/cache-public-e2e.mjs");
for (const engine of ["chromium", "webkit", "firefox"])
  run("tests/guard-navigation-e2e.mjs", [], { VT_ENGINE: engine });

// 0.4.4 : conservation pendant la navigation et les sauvegardes, fidélité
// éditeur / publié / premier affichage, sur les trois moteurs.
for (const engine of ["chromium", "webkit", "firefox"]) {
  run("tests/conservation-e2e.mjs", [], { VT_ENGINE: engine });
  run("tests/fidelite-e2e.mjs", [], { VT_ENGINE: engine });
}

// 0.4.5 : ressources de l'éditeur (document hôte, Navigation sous animation,
// onglet masqué, édition allégée), sur les trois moteurs.
for (const engine of ["chromium", "webkit", "firefox"])
  run("tests/ressources-e2e.mjs", [], { VT_ENGINE: engine });
