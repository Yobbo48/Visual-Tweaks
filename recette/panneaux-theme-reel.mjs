#!/usr/bin/env node
/* Panneaux sur le thème réel : Structure (sélection par l'arbre), Assets
   (logo répertorié), médiathèque (« Remplacer l'image » sur le logo, puis
   fermeture sans choix). Rien n'est enregistré.

   node recette/panneaux-theme-reel.mjs --base http://127.0.0.1:9410 --version 045 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { lancer, contexte, connecter, prive } from "./navigateur.mjs";

const args = process.argv.slice(2);
const option = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = option("base", "http://127.0.0.1:9410");
const version = option("version", "045");
const engine = process.env.VT_ENGINE || "chromium";
const controles = [], releves = {};
const reussi = (t) => (controles.push(t), console.log("PASS", `${version} ${engine}: ${t}`));
const browser = await lancer({ engine });
const context = await contexte(browser, version, { viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
const ui = (s) => page.locator(`#vt-editor-host ${s}`);
const frame = () => page.frameLocator("#vt-editor-host iframe");
const diag = () => page.evaluate(() => VisualTweaksEditor.diagnostics());
try {
  await connecter(page, base);
  await page.goto(base + "/?vt-edit=1");
  await page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(2000);

  // Structure : la sélection dans l'aperçu ouvre et marque sa ligne ; un
  // clic sur une ligne de l'arbre sélectionne l'élément.
  await ui("#structure-tab").click();
  const lignes = ui(".structure-item");
  releves.structure = await lignes.count();
  assert.ok(releves.structure > 10, `Structure : ${releves.structure} lignes`);
  await frame().locator("div.bande-lieu").click({ position: { x: 6, y: 6 }, force: true });
  const ligneBande = ui('.structure-item[title="bande-lieu"]');
  await page.waitForFunction(() => {
    const n = document.querySelector("#vt-editor-host").shadowRoot.querySelector('.structure-item[title="bande-lieu"]');
    return n && n.getAttribute("aria-selected") === "true" && n.checkVisibility();
  }, null, { timeout: 5000 });
  const ligneHero = ui('.structure-item[title="hero · hero--photo"]');
  assert.equal(await ligneHero.count(), 1, "ligne du bandeau hero");
  await ligneHero.click();
  await page.waitForFunction(() => /hero/.test(JSON.stringify(VisualTweaksEditor.diagnostics().selected)), null, { timeout: 5000 });
  releves.selectionDepuisStructure = (await diag()).selected;
  assert.equal(await frame().locator("section.hero").count(), 1);
  reussi(`Structure : ${releves.structure} lignes ; la bande sélectionnée dans l'aperçu est ouverte et marquée dans l'arbre, un clic sur la ligne « hero » sélectionne le bandeau`);

  // Assets : le logo est répertorié.
  await ui("#assets-tab").click();
  await page.waitForTimeout(800);
  releves.assets = await ui(".asset-card").count();
  const nomLogo = await frame().locator("img.logo__sceau").evaluate((n) => n.getAttribute("src").split("/").pop());
  const carteLogo = ui(".asset-card").filter({ hasText: nomLogo.slice(0, 20) });
  releves.carteLogo = await carteLogo.count();
  assert.ok(releves.assets > 0 && releves.carteLogo >= 1, `Assets : ${releves.assets} cartes, logo ${releves.carteLogo}`);
  reussi(`Assets : ${releves.assets} cartes, dont le logo`);

  // Médiathèque : « Remplacer l'image » sur le logo, fermeture sans choix.
  await frame().locator("img.logo__sceau").click({ position: { x: 10, y: 10 }, force: true });
  await page.waitForFunction(() => /logo__sceau/.test(JSON.stringify(VisualTweaksEditor.diagnostics().selected)));
  const remplacer = ui("#replace-image");
  const action = ui("#context-toolbar button", { hasText: "Remplacer" });
  if (await remplacer.count()) await remplacer.click();
  else await page.locator("#vt-editor-host #context-toolbar button").filter({ hasText: "Remplacer" }).first().click();
  await page.locator(".media-modal:visible").waitFor({ timeout: 15000 });
  releves.mediatheque = await page.locator(".media-modal:visible .media-frame-title").textContent().catch(() => null);
  await page.locator(".media-modal:visible .media-modal-close").click();
  await page.locator(".media-modal").first().waitFor({ state: "hidden", timeout: 5000 });
  assert.equal((await diag()).dirty, false, "fermeture sans choix : rien de modifié");
  reussi(`médiathèque ouverte depuis le logo (« ${String(releves.mediatheque).trim()} »), fermée sans choix : aucune modification`);
  assert.deepEqual(erreurs, []);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(prive, `resultats/panneaux-${version}-${engine}.json`), JSON.stringify({ engine, version, controles, releves, erreurs }, null, 2));
  await browser.close();
}
