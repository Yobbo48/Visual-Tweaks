#!/usr/bin/env node
/* Conservation sur le thème réel, copie de test seulement : modifier la bande,
   enregistrer, changer de page et revenir, recharger ; brouillon non
   enregistré à travers un changement de page ; annulation. Données vérifiées
   par l'API REST et sur la page publique (CSS serveur et rendu).

   node recette/conservation-theme-reel.mjs --base http://127.0.0.1:9410 --version 045
   La copie de test est ensuite remise à l'export de production (redémarrage
   du site : import octet pour octet). */
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { lancer, contexte, connecter, prive } from "./navigateur.mjs";

const args = process.argv.slice(2);
const option = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = option("base", "http://127.0.0.1:9410");
const version = option("version", "045");
const engine = process.env.VT_ENGINE || "chromium";
const exportProd = JSON.parse(readFileSync(path.join(prive, "recu/visual-tweaks-options-production.json"), "utf8"));
const pageProd = exportProd.options.find((o) => o.page === "/").value;
const bandeProd = pageProd.elements.find((e) => e.selector === "div.bande-lieu");

const controles = [], observations = [];
const reussi = (t) => (controles.push(t), console.log("PASS", `${version} ${engine}: ${t}`));
const note = (t) => (observations.push(t), console.log("NOTE", `${version}: ${t}`));
const browser = await lancer({ engine });
const context = await contexte(browser, version, { viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
page.on("dialog", (d) => d.accept());
const ui = (s) => page.locator(`#vt-editor-host ${s}`);
const frame = () => page.frameLocator("#vt-editor-host iframe");
const diag = () => page.evaluate(() => VisualTweaksEditor.diagnostics());
const etat = () => ui("#state").textContent();
async function pret() {
  await page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
}
async function ouvrir(route) {
  await page.goto(base + route + (route.includes("?") ? "&" : "?") + "vt-edit=1");
  await pret();
}
const api = () =>
  page.evaluate(async () => {
    const cfg = window.VisualTweaksConfig.editor;
    const r = await fetch(`${cfg.api}${cfg.api.includes("?") ? "&" : "?"}page=${encodeURIComponent("/")}`, { headers: { "X-WP-Nonce": cfg.nonce } });
    return r.json();
  });
const bande = (donnees) => donnees.elements.find((e) => e.selector === "div.bande-lieu");
const translateCadre = () => frame().locator("div.bande-lieu").evaluate((n) => getComputedStyle(n).translate);
const selectionner = async () => {
  await frame().locator("div.bande-lieu").click({ position: { x: 6, y: 6 }, force: true });
  await page.waitForFunction(() => !!VisualTweaksEditor.diagnostics().selected);
};
const enregistrer = async () => {
  await ui("#save").click();
  await page.waitForFunction(() => document.querySelector("#vt-editor-host").shadowRoot.querySelector("#state")?.textContent === "Enregistré", null, { timeout: 20000 });
};
const publicBande = async () => {
  const visiteur = await contexte(browser, version, { viewport: { width: 1440, height: 900 } });
  const p = await visiteur.newPage();
  // Réponse brute du serveur : le runtime retire ensuite les styles imprimés.
  const html = await (await p.goto(base + "/")).text();
  await p.waitForFunction(() => document.documentElement.hasAttribute("data-vt-runtime"));
  const translate = await p.locator("div.bande-lieu").evaluate((n) => getComputedStyle(n).translate);
  await visiteur.close();
  const css = /<style id="vt-published-styles">([\s\S]*?)<\/style>/.exec(html)?.[1] || "";
  return { translate, cssServeur: /\/\* div\.bande-lieu \*\/[^}]*\+ (-?\d+px)\)/.exec(css)?.[1] };
};

try {
  await connecter(page, base);
  await ouvrir("/");
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("visual-tweaks")) localStorage.removeItem(k); });
  await ouvrir("/");
  const depart = await api();
  assert.equal(depart.revision, pageProd.revision, "départ = export de production");
  assert.deepEqual(depart.elements, pageProd.elements);
  assert.equal(await translateCadre(), "0px -18px");

  // 1. Modifier, enregistrer, vérifier les données.
  await selectionner();
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === true);
  await enregistrer();
  const apres = await api();
  assert.equal(apres.revision, depart.revision + 1);
  assert.equal(bande(apres).changes.desktop.translateY, "-16px");
  assert.equal(bande(apres).changes.mobile.translateY, bandeProd.changes.mobile.translateY, "mobile intact");
  assert.deepEqual(apres.elements.find((e) => e.selector === "img.logo__sceau"), pageProd.elements.find((e) => e.selector === "img.logo__sceau"), "logo intact");
  reussi(`bande déplacée de 2 px puis enregistrée : révision ${depart.revision} → ${apres.revision}, desktop -18px → -16px, mobile et logo inchangés`);

  // 2. Changer de page puis revenir ; recharger ; site public.
  await ouvrir("/soins-energetiques/");
  await ouvrir("/");
  assert.equal(await etat(), "Enregistré");
  assert.equal(await translateCadre(), "0px -16px");
  await page.reload();
  await pret();
  assert.equal(await etat(), "Enregistré");
  assert.equal(await translateCadre(), "0px -16px");
  const pub = await publicBande();
  assert.deepEqual(pub, { translate: "0px -16px", cssServeur: "-16px" });
  reussi("retour sur l'accueil puis rechargement : état « Enregistré », bande à -16px dans l'aperçu ; site public : CSS serveur et rendu à -16px");

  // 3. Brouillon non enregistré à travers un changement de page.
  await selectionner();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === true);
  await ouvrir("/soins-energetiques/");
  assert.equal((await api()).revision, apres.revision, "rien d'enregistré pendant le départ");
  await ouvrir("/");
  const d = await diag();
  const restaure = await translateCadre();
  if (d.recoveryPending) {
    note(`brouillon proposé à la récupération (recoveryPending), aperçu à ${restaure}`);
    const bouton = ui("#recovery button").first();
    if (await bouton.count()) {
      note(`récupération : « ${(await bouton.textContent()).trim()} »`);
      await bouton.click();
      await page.waitForTimeout(800);
    }
  } else note(`brouillon restauré automatiquement, état « ${await etat()} »`);
  assert.equal(await translateCadre(), "0px -15px", "brouillon restauré (-15px)");
  assert.equal(await etat(), "Modifications non enregistrées");
  reussi(`brouillon non enregistré conservé à travers un changement de page (-15px), révision ${apres.revision} inchangée`);

  // 4. Annulation jusqu'à l'état enregistré.
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === false, null, { timeout: 5000 }).catch(() => {});
  const annule = await translateCadre();
  const dirty = (await diag()).dirty;
  if (annule === "0px -16px" && dirty === false) reussi("annulation : retour à l'état enregistré (-16px), plus de modification en attente");
  else {
    note(`annulation après récupération : aperçu ${annule}, dirty ${dirty}`);
    await ui("#discard").click();
    await page.waitForTimeout(800);
    assert.equal(await translateCadre(), "0px -16px", "« Revenir à la sauvegarde »");
    reussi("brouillon abandonné par « Revenir à la sauvegarde » : retour à -16px");
  }
  assert.equal((await api()).revision, apres.revision);
  assert.deepEqual(erreurs, []);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(prive, `resultats/conservation-${version}-${engine}.json`), JSON.stringify({ engine, version, controles, observations, erreurs }, null, 2));
  await browser.close();
}
