import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

// Options (0.4.5), sans effet sur l'exécution par défaut :
//   --continuer       poursuit après un échec, puis échoue à la fin s'il y en a eu ;
//                     résumé dans artifacts/validation-resume.json.
//   --sans-theme-reel les suites qui demandent le thème réel (serveur 9411,
//                     .local/real-theme) sont consignées « non exécutées ».
const continuer = process.argv.includes("--continuer");
const sansThemeReel = process.argv.includes("--sans-theme-reel");
const needsRealTheme = (file, args) =>
  /real-theme-e2e|guard-visibility-e2e|stabilisation-e2e/.test(file) ||
  args.includes("--comfort-real-theme");
const resume = [];
const save = () => {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/validation-resume.json",
    JSON.stringify(resume, null, 2),
  );
};

// Run serially: WordPress refreshes the account nonce/session on login.
const run = (file, args = [], env = {}) => {
  const entry = {
    file,
    args,
    engine: env.VT_ENGINE || (file.startsWith("tests/") ? "chromium" : ""),
  };
  if (sansThemeReel && needsRealTheme(file, args)) {
    console.log(`SKIP ${file} ${args.join(" ")} ${env.VT_ENGINE || ""} (thème réel absent)`);
    resume.push({ ...entry, status: "non exécuté : thème réel absent" });
    return save();
  }
  console.log(`RUN ${file} ${args.join(" ")} ${env.VT_ENGINE || ""}`);
  const start = Date.now();
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  resume.push({
    ...entry,
    status: result.status === 0 ? "réussi" : `échec (${result.status})`,
    durationS: Math.round((Date.now() - start) / 1000),
  });
  save();
  if (result.status !== 0 && !continuer) process.exit(result.status || 1);
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
// onglet masqué, édition allégée), puis l'édition allégée en détail, sur les
// trois moteurs.
for (const engine of ["chromium", "webkit", "firefox"]) {
  run("tests/ressources-e2e.mjs", [], { VT_ENGINE: engine });
  run("tests/allege-e2e.mjs", [], { VT_ENGINE: engine });
}

const failed = resume.filter((r) => r.status.startsWith("échec"));
console.log(
  `RÉSUMÉ ${resume.filter((r) => r.status === "réussi").length} réussies, ${failed.length} en échec, ${resume.filter((r) => r.status.startsWith("non")).length} non exécutées`,
);
for (const r of failed) console.log(`ÉCHEC ${r.file} ${r.args.join(" ")} ${r.engine}`);
if (failed.length) process.exit(1);
