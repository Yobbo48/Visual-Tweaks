#!/usr/bin/env node
/* Mesure courte des ressources consommées par Visual Tweaks (Chromium seul).
   Un scénario par appel, sans exécution parallèle, fenêtre de 10 à 30 s.

   node dev/mesure-ressources.mjs <scénario> [--duree 15] [--sortie f.json]
        [--page "/?vt-test=animated"] [--base http://127.0.0.1:9410] [--leger]

   Scénarios
     preparer           publie deux retouches sur la page (une seule fois)
     public             visiteur, page publique au repos
     public-defilement  visiteur, défilement continu
     repos              éditeur ouvert, aucune action
     repos-selection    éditeur, un élément sélectionné, onglet Assets, aucune action
     defilement         éditeur, élément sélectionné, défilement continu
     interactions       éditeur : défilement, sélections, déplacement, écrans
     navigations        éditeur rouvert sur 4 pages successives, puis repos
     masque             éditeur ouvert dans un onglet passé à l'arrière-plan
     masque-retour      onglet masqué (avec --fenetre : réellement hidden), puis réaffiché

   Mesures sur la fenêtre (après 1,5 s de stabilisation) :
     - CPU par processus (SystemInfo.getProcessInfo, toutes les secondes) :
       moyenne et pic d'une seconde, rendu (renderer), GPU, navigateur ;
     - fil principal occupé (Performance.getMetrics TaskDuration), script,
       nombre et durée des recalculs de style et des mises en page ;
     - profil CPU échantillonné (500 µs), temps propre regroupé par origine :
       thème, runtime public (runtime/styles/selection/background-layers),
       éditeur (autres modules de Visual Tweaks), WordPress, rendu natif ;
     - tâches récurrentes (sonde légère, identique avant/après) : rappels
       requestAnimationFrame, minuteries et observateurs de mutations, par origine ;
     - mémoire après collecte : tas JS, nœuds, écouteurs, documents.
   Les requêtes hors 127.0.0.1 sont coupées (aucun envoi externe).        */
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
const SCENARIO = args[0] || "repos";
const BASE = option("base", "http://127.0.0.1:9410").replace(/\/$/, "");
const PAGE = option("page", "/?vt-test=animated");
const AUTRE = option("autre", "/?second=1&vt-test=animated");
// Trois éléments à sélectionner (banc animé par défaut). Thème réel de
// L'Énergie des Runes : --page / --autre <autre page> --cibles ".bande-lieu,img.logo__sceau,h1"
const [CIBLE, CIBLE2, CIBLE3] = option(
  "cibles",
  '[data-vt-id="anim-title"],[data-vt-id="anim-cta"],[data-vt-id="anim-temoignages"]',
).split(/,(?![^\[]*\])/);
const DUREE = Number(option("duree", SCENARIO === "repos" ? 30 : 15));
const SORTIE = option("sortie", null);
const LEGER = args.includes("--leger");
// --fenetre : navigateur avec fenêtre (sous Xvfb en CI), seul moyen d'obtenir
// un onglet réellement « hidden » quand un autre passe au premier plan.
const FENETRE = args.includes("--fenetre");
const withQuery = (path, query) =>
  path + (path.includes("?") ? "&" : "?") + query;

/* Sonde : compte les rappels, classés par origine du code qui les programme.
   Coût : une pile d'appel par programmation (quelques µs). */
const SONDE = `(() => {
  const w = window; if (w.__vtProbe) return;
  const probe = w.__vtProbe = { raf: {}, timers: {}, mutations: {}, records: {}, longTasks: 0 };
  const origin = () => {
    const stack = new Error().stack || "";
    for (const line of stack.split("\\n").slice(2)) {
      const m = line.match(/(https?:\\/\\/[^\\s)]+)/);
      if (!m) continue;
      const url = m[1];
      if (/\\/themes\\//.test(url)) return "theme";
      if (/visual-tweaks\\/assets\\/(runtime|styles|selection|background-layers)\\.js/.test(url)) return "runtime";
      if (/visual-tweaks\\/assets\\//.test(url)) return "editeur";
      if (/wp-(includes|admin)\\//.test(url)) return "wordpress";
      return "autre";
    }
    return "inconnu";
  };
  const add = (bag, key, n = 1) => (bag[key] = (bag[key] || 0) + n);
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = (cb) => { const o = origin(); return raf((t) => { add(probe.raf, o); return cb(t); }); };
  for (const name of ["setTimeout", "setInterval"]) {
    const orig = w[name].bind(w);
    w[name] = (cb, ...rest) => {
      if (typeof cb !== "function") return orig(cb, ...rest);
      const o = origin();
      return orig(function (...a) { add(probe.timers, o); return cb.apply(this, a); }, ...rest);
    };
  }
  const MO = w.MutationObserver;
  w.MutationObserver = class extends MO {
    constructor(cb) { const o = origin(); super((records, obs) => { add(probe.mutations, o); add(probe.records, o, records.length); return cb(records, obs); }); }
  };
  try { new PerformanceObserver((l) => (probe.longTasks += l.getEntries().length)).observe({ type: "longtask" }); } catch {}
})();
//# sourceURL=vt-sonde.js`;

const browser = await chromium.launch({
  headless: !FENETRE,
  ...(process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
  args: [
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    // Aucune limitation propre au mode sans fenêtre : l'onglet reste « visible ».
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ].filter((a) => !SCENARIO.startsWith("masque") || !a.includes("background")),
});
const systeme = await browser.newBrowserCDPSession();
const context = await browser.newContext({
  viewport: { width: 1560, height: 1000 },
});
await context.addInitScript(SONDE);
let page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
let cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

const metrics = async () =>
  Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
      m.name,
      m.value,
    ]),
  );
const processes = async () => {
  const { processInfo } = await systeme.send("SystemInfo.getProcessInfo");
  const sum = { renderer: 0, gpu: 0, browser: 0, other: 0 };
  for (const p of processInfo) {
    const type = p.type.toLowerCase();
    sum[type in sum ? type : "other"] += p.cpuTime;
  }
  return sum;
};
const probe = () =>
  page.evaluate(() => {
    const frame = document
      .querySelector("#vt-editor-host")
      ?.shadowRoot?.querySelector("iframe")?.contentWindow;
    const pick = (w) =>
      w?.__vtProbe ? JSON.parse(JSON.stringify(w.__vtProbe)) : null;
    return { top: pick(window), frame: pick(frame) };
  });
const settle = (ms) => page.waitForTimeout(ms);
const ui = (s) => page.locator(`#vt-editor-host ${s}`);
const frame = () => page.frameLocator("#vt-editor-host iframe");

async function login() {
  await page.goto(`${BASE}/wp-login.php`);
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
}
async function openEditor(path) {
  await page.goto(BASE + withQuery(path, "vt-edit=1"));
  await page.waitForFunction(
    () => window.VisualTweaksEditor?.diagnostics?.().ready === true,
    null,
    { timeout: 60000 },
  );
  await page.waitForLoadState("networkidle");
  if (LEGER) await ui("#light-mode").click();
}
async function select(selector) {
  await frame().locator(selector).first().click({ position: { x: 4, y: 4 }, force: true });
  await page.waitForFunction(
    () => !!window.VisualTweaksEditor.diagnostics().selected,
  );
}
async function memory() {
  await cdp.send("HeapProfiler.collectGarbage");
  const m = await metrics();
  return {
    tasJSMo: +(m.JSHeapUsedSize / 1048576).toFixed(2),
    noeuds: m.Nodes,
    ecouteurs: m.JSEventListeners,
    documents: m.Documents,
    cadres: m.Frames,
  };
}
async function wheel(deadline, step = 100, interval = 100) {
  const box = (await page.locator("#vt-editor-host").count())
    ? await page.locator("#vt-editor-host .stage").boundingBox()
    : null;
  const x = box ? box.x + box.width / 2 : 700,
    y = box ? box.y + box.height / 2 : 500;
  await page.mouse.move(x, y);
  let direction = 1,
    count = 0;
  while (Date.now() < deadline) {
    await page.mouse.wheel(0, direction * step);
    if (++count % 25 === 0) direction = -direction;
    await page.waitForTimeout(interval);
  }
  crans += count;
}
let crans = 0;

/* Profil CPU : temps propre par origine (la catégorie d'une fonction native
   sans adresse est celle de son appelant). */
function attribuer(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes)
    for (const c of n.children || []) parent.set(c, n.id);
  const category = new Map();
  const classify = (url, name) => {
    if (name === "(program)") return "rendu natif";
    if (name === "(idle)") return "inactif";
    if (name === "(garbage collector)") return "ramasse-miettes";
    if (!url) return null;
    if (url.endsWith("vt-sonde.js")) return "sonde de mesure";
    if (/\/themes\//.test(url)) return "thème";
    if (
      /visual-tweaks\/assets\/(runtime|styles|selection|background-layers)\.js/.test(
        url,
      )
    )
      return "runtime public";
    if (/visual-tweaks\/assets\//.test(url)) return "éditeur";
    if (/wp-(includes|admin)\//.test(url)) return "WordPress";
    if (/^(extensions|chrome|v8\/|node:)/.test(url) || url.startsWith("<"))
      return "autre";
    return "page (en ligne)";
  };
  const resolveCategory = (id) => {
    if (category.has(id)) return category.get(id);
    const n = nodes.get(id);
    let c = classify(n.callFrame.url, n.callFrame.functionName);
    if (!c) c = parent.has(id) ? resolveCategory(parent.get(id)) : "autre";
    category.set(id, c);
    return c;
  };
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
    self.set(profile.samples[i], (self.get(profile.samples[i]) || 0) + dt);
  }
  const byCategory = {},
    byFunction = new Map();
  for (const [id, ms] of self) {
    const c = resolveCategory(id);
    byCategory[c] = (byCategory[c] || 0) + ms;
    if (["thème", "runtime public", "éditeur"].includes(c)) {
      const f = nodes.get(id).callFrame;
      const key = `${c} · ${f.functionName || "(anonyme)"} ${f.url.split("/").pop().split("?")[0]}:${f.lineNumber + 1}`;
      byFunction.set(key, (byFunction.get(key) || 0) + ms);
    }
  }
  for (const k of Object.keys(byCategory))
    byCategory[k] = +byCategory[k].toFixed(1);
  return {
    parOrigine: byCategory,
    fonctions: [...byFunction]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, v]) => `${v.toFixed(1).padStart(7)} ms  ${k}`),
  };
}

async function fenetre(action = async () => {}) {
  await settle(1500);
  const m0 = await metrics(),
    c0 = await processes(),
    s0 = await probe();
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
  await cdp.send("Profiler.start");
  const samples = [];
  let last = { t: Date.now(), cpu: c0 };
  const timer = setInterval(async () => {
    const now = { t: Date.now(), cpu: await processes() };
    const dt = (now.t - last.t) / 1000;
    const total = (o) => o.renderer + o.gpu + o.browser + o.other;
    samples.push({
      total: (100 * (total(now.cpu) - total(last.cpu))) / dt,
      renderer: (100 * (now.cpu.renderer - last.cpu.renderer)) / dt,
    });
    last = now;
  }, 1000);
  const t0 = Date.now(),
    deadline = t0 + DUREE * 1000;
  await action(deadline);
  const rest = deadline - Date.now();
  if (rest > 0) await page.waitForTimeout(rest);
  clearInterval(timer);
  const wall = (Date.now() - t0) / 1000;
  const { profile } = await cdp.send("Profiler.stop");
  const m1 = await metrics(),
    c1 = await processes(),
    s1 = await probe();
  const total = (o) => o.renderer + o.gpu + o.browser + o.other;
  const delta = (k) => m1[k] - m0[k];
  const diff = (a, b) => {
    if (!b) return null;
    const out = {};
    for (const bag of ["raf", "timers", "mutations", "records"]) {
      out[bag] = {};
      for (const [k, v] of Object.entries(b[bag] || {})) {
        const d = v - (a?.[bag]?.[k] || 0);
        if (d) out[bag][k] = +(d / wall).toFixed(1);
      }
    }
    out.longTasks = (b.longTasks || 0) - (a?.longTasks || 0);
    return out;
  };
  return {
    dureeS: +wall.toFixed(1),
    crans,
    cpu: {
      moyennePct: +((100 * (total(c1) - total(c0))) / wall).toFixed(1),
      rendererPct: +((100 * (c1.renderer - c0.renderer)) / wall).toFixed(1),
      gpuPct: +((100 * (c1.gpu - c0.gpu)) / wall).toFixed(1),
      navigateurPct: +((100 * (c1.browser - c0.browser)) / wall).toFixed(1),
      picPct: +Math.max(...samples.map((s) => s.total)).toFixed(1),
      picRendererPct: +Math.max(...samples.map((s) => s.renderer)).toFixed(1),
    },
    filPrincipal: {
      occupePct: +((100 * delta("TaskDuration")) / wall).toFixed(1),
      scriptMsParS: +((1000 * delta("ScriptDuration")) / wall).toFixed(1),
      recalculsStyleParS: +(delta("RecalcStyleCount") / wall).toFixed(1),
      recalculsStyleMsParS: +(
        (1000 * delta("RecalcStyleDuration")) /
        wall
      ).toFixed(1),
      misesEnPageParS: +(delta("LayoutCount") / wall).toFixed(1),
      misesEnPageMsParS: +((1000 * delta("LayoutDuration")) / wall).toFixed(1),
    },
    profil: attribuer(profile),
    recurrentParS: { haut: diff(s0.top, s1.top), cadre: diff(s0.frame, s1.frame) },
    memoire: await memory(),
  };
}

const resultat = { scenario: SCENARIO, page: PAGE, leger: LEGER, date: new Date().toISOString() };
try {
  if (SCENARIO.startsWith("public")) {
    await page.goto(BASE + PAGE);
    await page.waitForLoadState("networkidle");
    resultat.mesure = await fenetre(
      SCENARIO === "public-defilement" ? (d) => wheel(d) : undefined,
    );
  } else {
    await login();
    if (SCENARIO === "preparer") {
      await openEditor(PAGE);
      await select(CIBLE);
      for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
      await select(CIBLE2);
      for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
      await ui("#save").click();
      await ui("#state").filter({ hasText: /^Enregistré$/ }).waitFor();
      resultat.publie = await page.evaluate(
        () => window.VisualTweaksEditor.diagnostics().revision,
      );
    } else if (SCENARIO === "repos") {
      await openEditor(PAGE);
      resultat.mesure = await fenetre();
    } else if (SCENARIO === "repos-selection") {
      await openEditor(PAGE);
      await select(CIBLE);
      await ui("#assets-tab").click();
      resultat.mesure = await fenetre();
    } else if (SCENARIO === "defilement") {
      await openEditor(PAGE);
      await select(CIBLE);
      resultat.mesure = await fenetre((d) => wheel(d));
    } else if (SCENARIO === "interactions") {
      await openEditor(PAGE);
      resultat.mesure = await fenetre(async (deadline) => {
        const soon = () => Math.min(deadline, Date.now() + 2500);
        await wheel(soon());
        await select(CIBLE);
        await select(CIBLE2);
        await select(CIBLE3);
        const handle = await ui(".outline.selected .drag").boundingBox();
        if (handle) {
          const x = handle.x + handle.width / 2,
            y = handle.y + handle.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          for (let i = 1; i <= 20; i++) {
            await page.mouse.move(x + i * 3, y + i * 2);
            await page.waitForTimeout(16);
          }
          await page.mouse.up();
        }
        for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
        for (const m of ["mobile", "tablet", "desktop"]) {
          await ui(`[data-mode="${m}"]`).click();
          await page.waitForTimeout(400);
        }
        await ui("#assets-tab").click();
        await ui("#structure-tab").click();
        await wheel(soon());
      });
      await ui("#discard").click();
    } else if (SCENARIO === "navigations") {
      await openEditor(PAGE);
      resultat.memoireApresOuverture = await memory();
      resultat.memoireParNavigation = [];
      for (let i = 0; i < 4; i++) {
        await openEditor(i % 2 ? PAGE : AUTRE);
        await select(CIBLE);
        resultat.memoireParNavigation.push(await memory());
      }
      resultat.mesure = await fenetre();
    } else if (SCENARIO === "masque") {
      await openEditor(PAGE);
      await select(CIBLE);
      await ui("#assets-tab").click();
      const other = await context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      resultat.visibilite = await page.evaluate(() => document.visibilityState);
      resultat.mesure = await fenetre();
      await other.close();
    } else if (SCENARIO === "masque-retour") {
      // Onglet masqué (autre onglet au premier plan), puis réaffiché : la
      // seconde fenêtre doit retrouver le niveau du repos, sans rattrapage
      // qui s'accumule.
      await openEditor(PAGE);
      await select(CIBLE);
      await ui("#assets-tab").click();
      const other = await context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      await page.waitForTimeout(500);
      resultat.visibilite = await page.evaluate(() => document.visibilityState);
      resultat.mesure = await fenetre();
      await page.bringToFront();
      await other.close();
      resultat.visibiliteRetour = await page.evaluate(
        () => document.visibilityState,
      );
      resultat.retour = await fenetre();
      resultat.navigation = await page.evaluate(
        () => VisualTweaksEditor.diagnostics().navigation,
      );
    } else throw new Error(`Scénario inconnu : ${SCENARIO}`);
  }
} finally {
  resultat.erreurs = errors;
  await browser.close();
}
if (SORTIE) writeFileSync(SORTIE, JSON.stringify(resultat, null, 2));
const print = (m, label = "") => {
  console.log(
    `${SCENARIO}${label}${LEGER ? " (allégé)" : ""} — ${m.dureeS} s${m.crans ? ` (${m.crans} crans)` : ""} | CPU moyen ${m.cpu.moyennePct} % (rendu ${m.cpu.rendererPct}, GPU ${m.cpu.gpuPct}, navigateur ${m.cpu.navigateurPct}) | pic ${m.cpu.picPct} %`,
  );
  console.log(
    `fil principal occupé ${m.filPrincipal.occupePct} % | script ${m.filPrincipal.scriptMsParS} ms/s | style ${m.filPrincipal.recalculsStyleParS}/s (${m.filPrincipal.recalculsStyleMsParS} ms/s) | mise en page ${m.filPrincipal.misesEnPageParS}/s (${m.filPrincipal.misesEnPageMsParS} ms/s)`,
  );
  console.log("profil (ms) :", JSON.stringify(m.profil.parOrigine));
  for (const line of m.profil.fonctions) console.log("  " + line);
  console.log("récurrent /s :", JSON.stringify(m.recurrentParS));
  console.log("mémoire :", JSON.stringify(m.memoire));
};
if (resultat.mesure) print(resultat.mesure);
if (resultat.retour) print(resultat.retour, " (retour)");
if (resultat.memoireParNavigation)
  console.log(
    "mémoire après ouverture puis navigations :",
    JSON.stringify([resultat.memoireApresOuverture, ...resultat.memoireParNavigation].map((x) => x.tasJSMo)),
  );
if (resultat.visibilite)
  console.log(
    "visibilité :",
    resultat.visibilite,
    resultat.visibiliteRetour ? `puis ${resultat.visibiliteRetour}` : "",
  );
if (resultat.navigation)
  console.log("navigation :", JSON.stringify(resultat.navigation));
if (resultat.publie) console.log("révision publiée :", resultat.publie);
if (errors.length) console.log("ERREURS :", errors.join(" | "));
