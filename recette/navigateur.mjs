/* Navigateur de recette : Chromium (ou VT_ENGINE), aucune requête hors du
   banc. Les URL de médias à l'origine de production sont servies depuis la
   copie locale du site testé ; toute autre requête externe est coupée
   (Analytics, polices distantes, réseaux sociaux…) et comptée. */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "package.json"));
export const prive = path.join(root, ".local/production");
export const origineProduction = new URL(
  JSON.parse(readFileSync(path.join(prive, "recu/visual-tweaks-options-production.json"), "utf8")).site,
).origin;

export async function lancer({ engine = process.env.VT_ENGINE || "chromium", headless = true } = {}) {
  const pw = require("playwright")[engine];
  return pw.launch({
    headless,
    ...(engine === "chromium"
      ? {
          ...(process.env.VT_CHROMIUM_PATH ? { executablePath: process.env.VT_CHROMIUM_PATH } : {}),
          args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
        }
      : {}),
  });
}

/* Contexte isolé : médias de production servis par la copie locale du site
   (version 043 ou 045), le reste du monde coupé. */
export async function contexte(browser, version, options = {}) {
  const context = await browser.newContext(options);
  const uploads = path.join(prive, `site-${version}/uploads`);
  const coupees = new Set();
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.origin === origineProduction && url.pathname.startsWith("/wp-content/uploads/")) {
      const fichier = path.join(uploads, decodeURIComponent(url.pathname.slice("/wp-content/uploads/".length)));
      if (existsSync(fichier)) return route.fulfill({ path: fichier });
    }
    coupees.add(url.host);
    return route.abort("blockedbyclient");
  });
  context.coupees = coupees;
  return context;
}

export async function connecter(page, base) {
  await page.goto(base + "/wp-login.php?redirect_to=" + encodeURIComponent(base + "/"));
  // Focus automatique de wp-login.php (200 ms) : saisie après, puis vérifiée.
  await page
    .waitForFunction(() => document.activeElement?.id === "user_login", null, { timeout: 2000 })
    .catch(() => {});
  for (let essai = 0; essai < 3; essai++) {
    await page.locator("#user_login").fill("vt-admin");
    await page.locator("#user_pass").fill("vt-local-only-9410");
    if (
      (await page.locator("#user_login").inputValue()) === "vt-admin" &&
      (await page.locator("#user_pass").inputValue()) === "vt-local-only-9410"
    )
      break;
  }
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
}
