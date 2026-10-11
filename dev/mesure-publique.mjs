#!/usr/bin/env node
/* Performances publiques d'une page, visiteur anonyme, Chromium.
   node dev/mesure-publique.mjs --base http://127.0.0.1:9410 [--page /?vt-test=animated]
        [--profil desktop|mobile] [--cache froid|chaud] [--passages 3] [--sortie f.json]

   Par passage : chargement, 3 s d'observation, puis 2 s de défilement.
   - FCP, LCP (et son élément), CLS (hors saisie) ;
   - longues tâches et long-animation-frames (si disponibles) ;
   - trames : nombre, lentes (> 50 ms), très lentes (> 100 ms), pire trame,
     pendant le chargement puis pendant le défilement ;
   - requêtes et volume transféré (CDP), modules de Visual Tweaks demandés.
   Mobile : 390 × 844, densité 3, tactile, CPU ralenti × 4. Toute requête hors
   127.0.0.1 est coupée (aucun envoi Analytics).                              */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = option("base", "http://127.0.0.1:9410").replace(/\/$/, "");
const PAGE = option("page", "/?vt-test=animated");
const PROFIL = option("profil", "desktop");
const CACHE = option("cache", "froid");
const PASSAGES = Number(option("passages", 3));
const SORTIE = option("sortie", null);

const SONDE = `(() => {
  const m = (window.__vtPerf = { fcp: null, lcp: null, lcpEl: null, cls: 0, longues: [], loafs: 0, frames: { chargement: [], defilement: [] }, phase: "chargement" });
  const po = (type, cb) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true }); } catch {} };
  po("paint", (e) => { if (e.name === "first-contentful-paint") m.fcp = Math.round(e.startTime); });
  po("largest-contentful-paint", (e) => { m.lcp = Math.round(e.startTime); m.lcpEl = e.element ? e.element.localName + (e.element.className ? "." + String(e.element.className).split(" ")[0] : "") : null; });
  po("layout-shift", (e) => { if (!e.hadRecentInput) m.cls += e.value; });
  po("longtask", (e) => m.longues.push([Math.round(e.startTime), Math.round(e.duration)]));
  po("long-animation-frame", () => m.loafs++);
  let last = performance.now();
  const step = (t) => { m.frames[m.phase].push(t - last); last = t; requestAnimationFrame(step); };
  requestAnimationFrame(step);
})();
//# sourceURL=vt-perf-sonde.js`;

const browser = await chromium.launch({
  headless: true,
  ...(process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
  args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
});
const contextOptions =
  PROFIL === "mobile"
    ? {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      }
    : { viewport: { width: 1440, height: 900 } };
const summarize = (frames) => {
  const f = frames.slice(1);
  return {
    trames: f.length,
    lentes: f.filter((d) => d > 50).length,
    tresLentes: f.filter((d) => d > 100).length,
    pireTrame: Math.round(Math.max(0, ...f)),
  };
};
async function passage(context, warmup) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (PROFIL === "mobile")
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const reseau = { n: 0, octets: 0, cache: 0 };
  const urls = [];
  cdp.on("Network.requestWillBeSent", (e) => urls.push(e.request.url));
  cdp.on("Network.responseReceived", (e) => {
    if (e.response.fromDiskCache || e.response.fromMemoryCache) reseau.cache++;
  });
  cdp.on("Network.loadingFinished", (e) => {
    reseau.n++;
    reseau.octets += e.encodedDataLength;
  });
  await page.addInitScript(SONDE);
  await page.goto(BASE + PAGE, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  if (warmup) {
    await page.close();
    return null;
  }
  await page.evaluate(() => (window.__vtPerf.phase = "defilement"));
  await page.mouse.move(200, 400);
  for (let i = 0; i < 16; i++) {
    await page.mouse.wheel(0, i < 8 ? 250 : -250);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => window.__vtPerf);
  await page.close();
  return {
    fcp: m.fcp,
    lcp: m.lcp,
    lcpEl: m.lcpEl,
    cls: +m.cls.toFixed(4),
    longues: m.longues.length,
    longuesMs: m.longues.reduce((a, [, d]) => a + d, 0),
    loafs: m.loafs,
    chargement: summarize(m.frames.chargement),
    defilement: summarize(m.frames.defilement),
    requetes: reseau.n,
    ko: Math.round(reseau.octets / 1024),
    depuisCache: reseau.cache,
    modulesVT: [
      ...new Set(
        urls
          .filter((u) => /plugins\/visual-tweaks\//.test(u))
          .map((u) => u.split("/visual-tweaks/")[1].split("?")[0]),
      ),
    ].sort(),
  };
}
const passages = [];
let warm = null;
for (let i = 0; i < PASSAGES; i++) {
  if (CACHE === "chaud") {
    warm ||= await browser.newContext(contextOptions);
    if (i === 0) await passage(warm, true);
    passages.push(await passage(warm, false));
  } else {
    const context = await browser.newContext(contextOptions);
    passages.push(await passage(context, false));
    await context.close();
  }
}
await browser.close();
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const resume = {
  fcp: median(passages.map((p) => p.fcp)),
  lcp: median(passages.map((p) => p.lcp)),
  lcpEl: passages[0].lcpEl,
  cls: median(passages.map((p) => p.cls)),
  longues: median(passages.map((p) => p.longues)),
  loafs: median(passages.map((p) => p.loafs)),
  lentesChargement: median(passages.map((p) => p.chargement.lentes)),
  lentesDefilement: median(passages.map((p) => p.defilement.lentes)),
  pireTrame: median(passages.map((p) => Math.max(p.chargement.pireTrame, p.defilement.pireTrame))),
  requetes: median(passages.map((p) => p.requetes)),
  ko: median(passages.map((p) => p.ko)),
  modulesVT: passages[0].modulesVT,
};
const out = { base: BASE, page: PAGE, profil: PROFIL, cache: CACHE, date: new Date().toISOString(), resume, passages };
if (SORTIE) writeFileSync(SORTIE, JSON.stringify(out, null, 2));
console.log(`${BASE} ${PROFIL} ${CACHE} :`, JSON.stringify(resume));
