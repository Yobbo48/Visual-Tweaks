#!/usr/bin/env node
/* Banc de recette sur le thème réel : un WordPress isolé par version de
   l'extension, avec le thème et les options de production fournis.

   node recette/banc.mjs --version 045 --port 9410 [--wp 7.1.3 | --wp <url d'un zip>]

   Fichiers privés, lus dans .local/production/ (exclu de Git) :
   - theme/lenergiedesrunes/            thème complet, tel qu'en ligne ;
   - recu/visual-tweaks-options-production.json   export des options vt_* ;
   - ext/<version>/visual-tweaks/       extension testée (archive vérifiée) ;
   - substituts/                        fichiers de substitution documentés.
   Chaque site a ses données dans .local/production/site-<version>/.

   Ces fichiers ne doivent jamais passer par une CI publique : le banc refuse
   de démarrer sous GitHub Actions. */
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { requireTool } from "../dev/toolchain.mjs";

if (process.env.GITHUB_ACTIONS) {
  console.error("Banc de recette : fichiers privés, exécution en CI refusée.");
  process.exit(1);
}
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const root = fileURLToPath(new URL("../", import.meta.url));
const prive = path.join(root, ".local/production");
const version = option("version", "045");
const port = option("port", "9410");
const wp = option("wp", "7.1.3");
const site = path.join(prive, `site-${version}`);
const entrees = path.join(site, "entrees");
const theme = path.join(prive, "theme/lenergiedesrunes");
const extension = path.join(prive, `ext/${version}/visual-tweaks`);
const exportOptions = path.join(prive, "recu/visual-tweaks-options-production.json");
for (const requis of [theme, extension, exportOptions])
  if (!existsSync(requis)) throw new Error(`Fichier privé manquant : ${requis}`);

for (const d of ["database", "uploads", "entrees"]) mkdirSync(path.join(site, d), { recursive: true });
cpSync(exportOptions, path.join(entrees, "visual-tweaks-options-production.json"));
cpSync(path.join(prive, "substituts"), path.join(entrees, "substituts"), { recursive: true });

// Origine de production lue dans l'export (rien de propre au site dans le dépôt).
const origine = new URL(JSON.parse(readFileSync(exportOptions, "utf8")).site).origin;
const blueprint = {
  $schema: "https://playground.wordpress.net/blueprint-schema.json",
  landingPage: "/",
  login: false,
  steps: [
    {
      step: "defineWpConfigConsts",
      consts: {
        WP_ENVIRONMENT_TYPE: "local",
        AUTOMATIC_UPDATER_DISABLED: true,
        DISABLE_WP_CRON: true,
        WP_HTTP_BLOCK_EXTERNAL: true,
        VT_BANC_ORIGINE_MEDIAS: `${origine}/wp-content/uploads`,
      },
    },
    { step: "activatePlugin", pluginPath: "visual-tweaks/visual-tweaks.php" },
    { step: "activateTheme", themeFolderName: "lenergiedesrunes" },
    {
      step: "setSiteOptions",
      options: {
        blogname: "L’énergie des Runes",
        blog_public: "0",
        home: `http://127.0.0.1:${port}`,
        siteurl: `http://127.0.0.1:${port}`,
        permalink_structure: "/%postname%/",
      },
    },
    { step: "runPHP", code: "<?php require '/wordpress/wp-content/vt-banc/import.php';" },
  ],
};
writeFileSync(path.join(site, "blueprint.json"), JSON.stringify(blueprint, null, 2));

const cli = path.join(path.dirname(requireTool.resolve("@wp-playground/cli")), "cli.js");
const child = spawn(
  process.execPath,
  [
    cli,
    "server",
    `--port=${port}`,
    `--site-url=http://127.0.0.1:${port}`,
    "--php=8.3",
    `--wp=${wp}`,
    "--workers=6",
    `--mount=${extension}:/wordpress/wp-content/plugins/visual-tweaks`,
    `--mount=${theme}:/wordpress/wp-content/themes/lenergiedesrunes`,
    `--mount=${path.join(root, "recette/mu-plugins")}:/wordpress/wp-content/mu-plugins`,
    `--mount=${path.join(root, "recette")}:/wordpress/wp-content/vt-banc`,
    `--mount=${entrees}:/wordpress/wp-content/vt-banc-entrees`,
    `--mount=${path.join(site, "uploads")}:/wordpress/wp-content/uploads`,
    `--mount-before-install=${path.join(site, "database")}:/wordpress/wp-content/database`,
    `--blueprint=${path.join(site, "blueprint.json")}`,
  ],
  { cwd: root, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
