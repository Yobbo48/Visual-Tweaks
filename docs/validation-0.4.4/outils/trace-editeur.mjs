#!/usr/bin/env node
/* Attribution des mises en page et recalculs de style forcés par l'éditeur.
   Trace Chrome (devtools.timeline, piles JS) pendant : sélection, changement
   d'écran, défilement avec sélection. Regroupe les événements Layout /
   UpdateLayoutTree forcés par la fonction JS appelante (fichier:ligne).

   node trace-editeur.mjs BASE SORTIE.txt                                     */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(`${process.env.VT_BROWSER_TOOLCHAIN}/package.json`);
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:9520").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true, ...(process.env.VT_CHROMIUM_PATH ? { executablePath: process.env.VT_CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
const page = await context.newPage();
await page.goto(`${BASE}/wp-login.php`);
await page.fill("#user_login", "admin"); await page.fill("#user_pass", "password");
await Promise.all([page.waitForNavigation(), page.click("#wp-submit")]);
await page.goto(`${BASE}/?vt-edit=1`);
await page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics?.().ready === true, null, { timeout: 60000 });
const frame = page.frameLocator("#vt-editor-host iframe"), ui = (s) => page.locator(`#vt-editor-host ${s}`);
const cdp = await context.newCDPSession(page);
const lignes = [];
async function trace(nom, action) {
  const events = [];
  cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
  const fini = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.stack"] } });
  await action();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await cdp.send("Tracing.end"); await fini;
  cdp.removeAllListeners("Tracing.dataCollected");
  const parFonction = new Map(); let forces = 0, total = 0, duree = 0;
  for (const e of events) {
    if (!["Layout", "UpdateLayoutTree"].includes(e.name) || e.ph !== "X") continue;
    total++;
    const pile = e.args?.beginData?.stackTrace || e.args?.data?.stackTrace;
    if (!pile?.length) continue;
    forces++; duree += (e.dur || 0) / 1000;
    const vt = pile.filter((f) => /visual-tweaks|editor|navigation|runtime/.test(f.url || ""));
    const f = vt[0] || pile[0];
    const cle = `${e.name.padEnd(16)} ${(f.functionName || "(anonyme)").padEnd(22)} ${(f.url || "").split("/").pop().split("?")[0]}:${f.lineNumber + 1}  ← ${vt.slice(1, 3).map((x) => x.functionName || "?").join(" ← ")}`;
    const v = parFonction.get(cle) || { n: 0, ms: 0 }; v.n++; v.ms += (e.dur || 0) / 1000; parFonction.set(cle, v);
  }
  lignes.push(`\n== ${nom} : ${total} Layout/UpdateLayoutTree dont ${forces} forcés par JS (${duree.toFixed(1)} ms)`);
  for (const [k, v] of [...parFonction].sort((a, b) => b[1].n - a[1].n).slice(0, 14)) lignes.push(`  ${String(v.n).padStart(4)} × ${v.ms.toFixed(1).padStart(6)} ms  ${k}`);
}
await trace("sélection", async () => { await frame.locator(".bande-lieu").first().click({ position: { x: 5, y: 5 } }); });
await trace("changement d'écran (mobile)", () => ui('[data-mode="mobile"]').click());
await trace("changement d'écran (desktop)", () => ui('[data-mode="desktop"]').click());
await trace("défilement avec sélection (20 crans)", async () => {
  const box = await page.locator("#vt-editor-host").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let k = 0; k < 10; k++) await page.mouse.wheel(0, 120);
  for (let k = 0; k < 10; k++) await page.mouse.wheel(0, -120);
});
await trace("déplacement clavier (6)", async () => { for (let k = 0; k < 3; k++) { await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowLeft"); } });
await trace("onglet Assets puis Structure", async () => { await ui("#assets-tab").click(); await ui("#structure-tab").click(); });
await browser.close();
writeFileSync(process.argv[3] || "trace-editeur.txt", lignes.join("\n") + "\n");
console.log(lignes.join("\n"));
