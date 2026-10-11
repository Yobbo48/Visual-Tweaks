#!/usr/bin/env node
/* Mesure de l'éditeur Visual Tweaks sur un WordPress local (jamais la production).
   Chromium (CDP : Performance.getMetrics, collecte mémoire), CPU ralenti ×4.

   node mesure-editeur.mjs BASE SORTIE.json [--cycles 12]
   (VT_BROWSER_TOOLCHAIN = dossier contenant playwright ; VT_CHROMIUM_PATH facultatif)

   Actions mesurées (médiane de plusieurs répétitions) : ouverture de l'éditeur,
   sélection d'un élément, onglets Structure/Assets, panneau Réglages, changement
   d'écran, défilement de la page avec une sélection, déplacement au clavier,
   navigation vers une autre page puis retour.
   Pour chaque action : durée jusqu'à la deuxième image suivante, longues tâches,
   nombre et durée des recalculs de style et de mise en page, temps de script.
   Parcours répété (--cycles) : mémoire JS après collecte, écouteurs, nœuds,
   observateurs actifs (compteur posé avant le chargement des pages).          */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(`${process.env.VT_BROWSER_TOOLCHAIN}/package.json`);
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:9520").replace(/\/$/, "");
const SORTIE = process.argv[3] || "mesure-editeur.json";
const CYCLES = Number(process.argv[process.argv.indexOf("--cycles") + 1]) || 12;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

/* Compteur d'observateurs actifs et de minuteries, dans chaque document. */
const SONDE = `(() => {
  const w = window; w.__vtProbe = { observers: 0, longTasks: [] };
  for (const name of ["MutationObserver", "ResizeObserver", "IntersectionObserver"]) {
    const Orig = w[name]; if (!Orig) continue;
    w[name] = class extends Orig {
      constructor(cb) { super(cb); this.__on = false; }
      observe(...a) { if (!this.__on) { this.__on = true; w.__vtProbe.observers++; } return super.observe(...a); }
      disconnect() { if (this.__on) { this.__on = false; w.__vtProbe.observers--; } return super.disconnect(); }
    };
  }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__vtProbe.longTasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch {}
})();`;

const browser = await chromium.launch({ headless: true, ...(process.env.VT_CHROMIUM_PATH ? { executablePath: process.env.VT_CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
await context.addInitScript(SONDE);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

await page.goto(`${BASE}/wp-login.php`);
await page.fill("#user_login", "admin");
await page.fill("#user_pass", "password");
await Promise.all([page.waitForNavigation(), page.click("#wp-submit")]);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const frame = () => page.frameLocator("#vt-editor-host iframe");
const ui = (s) => page.locator(`#vt-editor-host ${s}`);
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const longTasks = () => page.evaluate(() => window.__vtProbe.longTasks.length);
async function ready() {
  await page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics?.().ready === true, null, { timeout: 60000 });
}
async function measure(name, action, results) {
  const m0 = await metrics(), l0 = await longTasks(), t0 = Date.now();
  await action();
  await settle();
  const dt = Date.now() - t0, m1 = await metrics(), l1 = await longTasks();
  (results[name] ||= []).push({
    ms: dt, longTasks: l1 - l0,
    recalcStyle: m1.RecalcStyleCount - m0.RecalcStyleCount, layout: m1.LayoutCount - m0.LayoutCount,
    styleMs: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000), layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
    scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
  });
}
async function openEditor(path, results, name = "ouverture") {
  const t0 = Date.now();
  await page.goto(`${BASE}${path}?vt-edit=1`);
  await ready();
  await settle();
  (results[name] ||= []).push({ ms: Date.now() - t0 });
}
async function selectIn(selector) {
  await frame().locator(selector).first().click({ position: { x: 5, y: 5 } });
  await page.waitForFunction(() => !!window.VisualTweaksEditor.diagnostics().selected);
}
async function snapshot() {
  await cdp.send("HeapProfiler.collectGarbage");
  const m = await metrics();
  const probe = await page.evaluate(() => {
    const f = document.querySelector("#vt-editor-host")?.shadowRoot?.querySelector("iframe");
    return { top: window.__vtProbe.observers, frame: f?.contentWindow?.__vtProbe?.observers ?? null };
  });
  return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), listeners: m.JSEventListeners, nodes: m.Nodes, documents: m.Documents, frames: m.Frames, observersTop: probe.top, observersFrame: probe.frame };
}

const results = {};
for (let i = 0; i < 3; i++) await openEditor("/", results);
for (let i = 0; i < 3; i++) {
  await measure("selection", () => selectIn(".bande-lieu"), results);
  await measure("selection-2", () => selectIn("img.logo__sceau"), results);
  await measure("onglet-assets", () => ui("#assets-tab").click(), results);
  await measure("onglet-structure", () => ui("#structure-tab").click(), results);
  await measure("panneau-reglages", async () => { await ui("#toggle-panel").click(); await ui("#toggle-panel").click(); }, results);
  await measure("ecran-mobile", () => ui('[data-mode="mobile"]').click(), results);
  await measure("ecran-tablette", () => ui('[data-mode="tablet"]').click(), results);
  await measure("ecran-desktop", () => ui('[data-mode="desktop"]').click(), results);
  await selectIn(".bande-lieu");
  await measure("defilement", async () => {
    const box = await page.locator("#vt-editor-host").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let k = 0; k < 15; k++) await page.mouse.wheel(0, 120);
    for (let k = 0; k < 15; k++) await page.mouse.wheel(0, -120);
  }, results);
  await measure("deplacement-clavier", async () => {
    for (let k = 0; k < 5; k++) await page.keyboard.press("ArrowRight");
    for (let k = 0; k < 5; k++) await page.keyboard.press("ArrowLeft");
  }, results);
  await ui("#discard").click();
}
/* Parcours répété dans une même session d'édition. */
const cycles = [await snapshot()];
for (let c = 1; c <= CYCLES; c++) {
  await selectIn(".bande-lieu");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowUp");
  await selectIn("img.logo__sceau");
  await ui("#assets-tab").click(); await ui("#structure-tab").click();
  await ui('[data-mode="mobile"]').click(); await ui('[data-mode="desktop"]').click();
  const box = await page.locator("#vt-editor-host").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let k = 0; k < 4; k++) await page.mouse.wheel(0, 150);
  for (let k = 0; k < 4; k++) await page.mouse.wheel(0, -150);
  await ui("#discard").click();
  await settle();
  if (c % 4 === 0) cycles.push({ cycle: c, ...(await snapshot()) });
}
/* Navigation entre pages (rechargement complet de l'éditeur). */
for (let i = 0; i < 3; i++) {
  await openEditor("/soins-energetiques/", results, "navigation-autre-page");
  await openEditor("/", results, "navigation-retour");
}
const navigation = await snapshot();
await browser.close();

const resume = {};
for (const [k, v] of Object.entries(results)) {
  const keys = Object.keys(v[0]);
  resume[k] = Object.fromEntries(keys.map((key) => [key, median(v.map((x) => x[key]))]));
  resume[k].n = v.length;
}
const sortie = { base: BASE, date: new Date().toISOString(), cpu: 4, resume, cycles, apresNavigation: navigation, errors, brut: results };
writeFileSync(SORTIE, JSON.stringify(sortie, null, 2));
console.table(resume);
console.table(cycles);
console.log("après 6 navigations :", navigation, errors.length ? "ERREURS " + errors.join(" | ") : "aucune erreur");
