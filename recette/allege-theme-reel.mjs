#!/usr/bin/env node
/* Recette du mode allégé sur le thème réel (0.4.5) : pluie de runes de
   main.js (canvas #pluie, boucle requestAnimationFrame), animations CSS,
   retouches réelles (bande, logo).

   node recette/allege-theme-reel.mjs --base http://127.0.0.1:9410 --version 045
   Rien n'est enregistré : les retouches faites ici sont annulées. */
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

// Passages de la pluie de runes : un clearRect du canvas #pluie par image.
const COMPTEUR = `(() => {
  const proto = CanvasRenderingContext2D.prototype, orig = proto.clearRect;
  proto.clearRect = function (...a) {
    if (this.canvas && this.canvas.id === "pluie") window.__vtBenchTicks = (window.__vtBenchTicks || 0) + 1;
    return orig.apply(this, a);
  };
})();`;

const controles = [];
const reussi = (texte) => {
  controles.push(texte);
  console.log("PASS", `${engine}: ${texte}`);
};
const browser = await lancer({ engine });
const context = await contexte(browser, version, { viewport: { width: 1400, height: 1000 } });
await context.addInitScript(COMPTEUR);
const page = await context.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
page.on("dialog", (d) => d.accept());
const ui = (s) => page.locator(`#vt-editor-host ${s}`);
const frame = () => page.frameLocator("#vt-editor-host iframe");
const body = () => frame().locator("body");
const diagnostics = () => page.evaluate(() => VisualTweaksEditor.diagnostics());
async function ouvrir(route) {
  await page.goto(base + route + (route.includes("?") ? "&" : "?") + "vt-edit=1");
  await page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
}
async function api(page0) {
  return page.evaluate(async (p) => {
    const cfg = window.VisualTweaksConfig.editor;
    const r = await fetch(`${cfg.api}${cfg.api.includes("?") ? "&" : "?"}page=${encodeURIComponent(p)}`, { headers: { "X-WP-Nonce": cfg.nonce } });
    return r.json();
  }, page0);
}
// Passages de la pluie et images natives par seconde, dans le cadre.
const boucle = () =>
  body().evaluate(async () => {
    const raf = window.__vtRequestAnimationFrame || window.requestAnimationFrame;
    const t0 = performance.now(), k0 = window.__vtBenchTicks || 0;
    let images = 0;
    await new Promise((fin) => {
      const pas = () => (images++, performance.now() - t0 >= 1500 ? fin() : raf(pas));
      raf(pas);
    });
    const dt = (performance.now() - t0) / 1000, passages = ((window.__vtBenchTicks || 0) - k0) / dt;
    return { passages: Math.round(passages), images: Math.round(images / dt), boucles: +(passages / (images / dt)).toFixed(2) };
  });
const unique = (m) => m.boucles >= 0.8 && m.boucles <= 1.2 && m.passages >= 10;
const etat = () =>
  body().evaluate(() => ({
    infinies: document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity).map((a) => a.playState),
    finiesEnPause: document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity && a.playState === "paused").length,
    traces: document.querySelectorAll("[data-vt-light-paused]").length + !!document.getElementById("vt-light-mode"),
    rafNatif: /\[native code\]/.test(String(window.requestAnimationFrame)) && window.__vtRequestAnimationFrame === undefined,
  }));
// La pluie bouge : deux lectures du canvas à 400 ms d'écart diffèrent.
const pluieBouge = () =>
  body().evaluate(async () => {
    const c = document.getElementById("pluie");
    const a = c.toDataURL();
    await new Promise((r) => setTimeout(r, 400));
    return c.toDataURL() !== a;
  });
const basculer = async (attendu) => {
  await ui("#light-mode").click();
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), String(attendu));
  await page.waitForTimeout(400);
};
const contourJuste = async () => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const { displayedBox: b } = await page.evaluate(() => VisualTweaksViewport.diagnostics());
  const o = await ui(".outline.selected").boundingBox();
  return !!o && Math.abs(o.x - b.left) <= 3 && Math.abs(o.y - b.top) <= 3 && Math.abs(o.width - b.width) <= 4 && Math.abs(o.height - b.height) <= 4;
};
const masquer = (cache) =>
  page.evaluate((cache) => {
    const docs = [document, document.querySelector("#vt-editor-host").shadowRoot.querySelector("iframe").contentDocument];
    for (const doc of docs) {
      if (cache) Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => "hidden" });
      else delete doc.visibilityState;
    }
    document.dispatchEvent(new Event("visibilitychange"));
  }, cache);

const mesures = {};
try {
  await connecter(page, base);
  await ouvrir("/");
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("visual-tweaks")) localStorage.removeItem(k); });
  await ouvrir("/");
  const enregistre = await api("/");
  assert.equal(enregistre.revision, pageProd.revision);
  assert.deepEqual(enregistre.elements, pageProd.elements);

  // 1. Bascules répétées.
  mesures.depart = { boucle: await boucle(), ...(await etat()) };
  assert.ok(unique(mesures.depart.boucle), `départ : ${JSON.stringify(mesures.depart.boucle)}`);
  mesures.bascules = [];
  for (let i = 0; i < 4; i++) {
    await basculer(true);
    const leger = { boucle: await boucle(), ...(await etat()) };
    assert.ok(leger.boucle.passages <= 6, `allégé : ${JSON.stringify(leger.boucle)}`);
    assert.ok(leger.infinies.every((s) => s === "paused"));
    assert.equal(leger.finiesEnPause, 0, "aucune animation finie figée");
    await basculer(false);
    const plein = { boucle: await boucle(), ...(await etat()), bouge: await pluieBouge() };
    assert.ok(unique(plein.boucle), `retour ${i + 1} : ${JSON.stringify(plein.boucle)}`);
    assert.ok(plein.infinies.every((s) => s === "running"));
    assert.equal(plein.traces, 0);
    assert.equal(plein.rafNatif, true);
    assert.equal(plein.bouge, true, "la pluie de runes bouge");
    mesures.bascules.push({ leger: leger.boucle, plein: plein.boucle });
  }
  reussi(`4 bascules : pluie de runes ${mesures.depart.boucle.passages}/s → ≤ 6/s → une seule boucle à pleine cadence (passages/images ${mesures.bascules.map((b) => b.plein.boucles).join(", ")}) ; ${mesures.depart.infinies.length} animation(s) CSS infinie(s) en pause puis relancée(s) ; aucune animation finie figée ; aucune trace laissée`);

  // 1 bis. Page complète parcourue en mode allégé : apparitions au défilement
  // (.rv → .in) et compteurs (data-count) menés à leur terme, rien de figé.
  await basculer(true);
  mesures.parcours = await body().evaluate(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const hauteur = document.documentElement.scrollHeight;
    for (let y = 0; y <= hauteur; y += Math.round(innerHeight * 0.6)) {
      window.scrollTo(0, y);
      await pause(350);
    }
    await pause(2500);
    const rv = [...document.querySelectorAll(".rv")];
    const compteurs = [...document.querySelectorAll("[data-count],[data-n]")];
    const cible = (el) => String(parseInt(el.dataset.count ?? el.dataset.n, 10));
    const resultat = {
      hauteur,
      apparitions: rv.length,
      nonApparues: rv.filter((n) => !n.classList.contains("in")).map((n) => n.className.slice(0, 40)),
      compteurs: compteurs.length,
      compteursInacheves: compteurs.filter((n) => n.textContent.trim() !== cible(n)).map((n) => `${n.textContent.trim()}≠${cible(n)}`),
    };
    window.scrollTo(0, 0);
    await pause(600);
    return resultat;
  });
  assert.ok(mesures.parcours.apparitions > 0, "apparitions présentes sur la page complète");
  assert.deepEqual(mesures.parcours.nonApparues, [], "apparitions terminées en mode allégé");
  assert.deepEqual(mesures.parcours.compteursInacheves, [], "compteurs terminés en mode allégé");
  await basculer(false);
  reussi(`Mode allégé, page complète parcourue (${mesures.parcours.hauteur} px) : ${mesures.parcours.apparitions} apparitions au défilement et ${mesures.parcours.compteurs} compteur(s) menés à leur terme, rien de figé`);

  // 2. Sélection, contours, déplacement et annulation en mode allégé.
  await basculer(true);
  for (const cible of ["div.bande-lieu", "img.logo__sceau"]) {
    await frame().locator(cible).click({ position: { x: 6, y: 6 }, force: true });
    await page.waitForFunction(() => !!VisualTweaksEditor.diagnostics().selected);
    assert.ok(await contourJuste(), `contour sur ${cible}`);
  }
  await frame().locator("div.bande-lieu").click({ position: { x: 6, y: 6 }, force: true });
  const avant = await frame().locator("div.bande-lieu").evaluate((n) => getComputedStyle(n).translate);
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === true);
  assert.notEqual(await frame().locator("div.bande-lieu").evaluate((n) => getComputedStyle(n).translate), avant);
  assert.ok(await contourJuste(), "contour après déplacement");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === false);
  assert.equal(await frame().locator("div.bande-lieu").evaluate((n) => getComputedStyle(n).translate), avant);
  reussi(`Mode allégé : sélection de la bande et du logo, contours exacts, déplacement au clavier puis annulation jusqu'à l'état enregistré (${avant})`);

  // 3. Navigation : préférence conservée, puis retirée.
  await ouvrir("/soins-energetiques/");
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), "true");
  assert.equal((await diagnostics()).lightMode?.active ?? (await diagnostics()).lightMode, true);
  await ouvrir("/");
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), "true");
  assert.ok((await boucle()).passages <= 6, "toujours allégé au retour sur l'accueil");
  reussi("Navigation entre pages : préférence conservée, mode appliqué au retour sur l'accueil");

  // 4. Onglet masqué puis réaffiché, mode conservé ; retour au rendu animé.
  await masquer(true);
  await page.waitForTimeout(800);
  await masquer(false);
  assert.ok((await boucle()).passages <= 6);
  const autre = await context.newPage();
  await autre.goto("about:blank");
  await autre.bringToFront();
  await page.waitForTimeout(1500);
  await page.bringToFront();
  await autre.close();
  assert.ok((await boucle()).passages <= 6, "toujours allégé après l'onglet en arrière-plan");
  await basculer(false);
  mesures.retour = { boucle: await boucle(), ...(await etat()), bouge: await pluieBouge() };
  assert.ok(unique(mesures.retour.boucle), `retour : ${JSON.stringify(mesures.retour.boucle)}`);
  assert.equal(mesures.retour.bouge, true);
  await ouvrir("/soins-energetiques/");
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), "false", "préférence retirée partout");
  reussi("Onglet masqué puis réaffiché : mode conservé, puis rendu animé rétabli sans boucle doublée ; préférence retirée partout une fois désactivée");

  // 5. Données inchangées ; visiteur sans aucune trace du mode allégé.
  await ouvrir("/");
  const apres = await api("/");
  assert.equal(apres.revision, pageProd.revision);
  assert.deepEqual(apres.elements, pageProd.elements);
  const visiteur = await contexte(browser, version, { viewport: { width: 1440, height: 900 } });
  await visiteur.addInitScript(COMPTEUR);
  const pub = await visiteur.newPage();
  const requetes = [];
  pub.on("request", (r) => requetes.push(r.url()));
  await pub.goto(base + "/");
  await pub.waitForTimeout(2500);
  const etatPublic = await pub.evaluate(() => ({
    traces: document.querySelectorAll("[data-vt-light-paused]").length + !!document.getElementById("vt-light-mode"),
    infinies: document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity).every((a) => a.playState === "running"),
  }));
  const modules = requetes.filter((u) => /plugins\/visual-tweaks\/assets\//.test(u)).map((u) => u.split("/assets/")[1].split("?")[0]).sort();
  await visiteur.close();
  assert.equal(etatPublic.traces, 0);
  assert.equal(etatPublic.infinies, true);
  assert.deepEqual(modules, ["background-layers.js", "runtime.js", "selection.js", "styles.js"]);
  reussi(`Données inchangées (révision ${apres.revision}, ${apres.elements.length} retouches identiques à l'export) ; visiteur : 4 modules publics, aucune trace du mode allégé, animations normales`);
  assert.deepEqual(erreurs, []);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(prive, `resultats/allege-${version}-${engine}.json`), JSON.stringify({ engine, version, controles, mesures, erreurs }, null, 2));
  await browser.close();
}
