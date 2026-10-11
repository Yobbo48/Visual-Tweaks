// 0.4.5 — édition allégée en détail, sur la variante média du banc animé
// (?vt-test=animated-media : boucle requestAnimationFrame comptée, animations
// CSS infinies, animation d'entrée, révélation par animation au défilement,
// vidéo en boucle). Ce banc n'est pas le thème réel de production.
//   1. bascules répétées : boucle ralentie puis rétablie, jamais doublée,
//      animations et vidéo en pause puis relancées, aucune trace laissée ;
//   2. animations d'entrée et révélations : jamais figées à mi-chemin ;
//   3. sélection, contour, déplacement (glisser, clavier) et annulation ;
//   4. navigation entre pages : préférence conservée, puis retirée ;
//   5. onglet masqué (simulé, puis réel en arrière-plan) et retour ;
//   6. données enregistrées et site public inchangés ; éditeur (allégé ou non)
//      = public pour les styles retouchés.
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const engine = process.env.VT_ENGINE || "chromium";
const browserType = require("playwright")[engine];
const browser = await browserType.launch({
  headless: true,
  ...(engine === "chromium" && process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
});
const base = "http://127.0.0.1:9410";
const path = `/?vt-test=animated-media-allege-${engine}`;
const other = `/?second=1&vt-test=animated-media-allege-${engine}`;
const coreErrors = [];
const isCoreRejection = (e) =>
  /^(\[object Object\]|Object)$/.test(e.message) &&
  (/wp-includes\/js\/dist\/preferences/.test(e.stack || "") ||
    (engine === "firefox" && !/https?:\/\//.test(e.stack || "")));
const checks = [],
  errors = [],
  notes = [];
const record = (text) => {
  checks.push(text);
  console.log("PASS", `${engine}: ${text}`);
};
const context = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) =>
  (isCoreRejection(e) ? coreErrors : errors).push(e.message),
);
page.on("dialog", (d) => d.accept());
const ui = (s) => page.locator(`#vt-editor-host ${s}`);
const frame = () => page.frameLocator("#vt-editor-host iframe");
const body = () => frame().locator("body");
const diagnostics = () => page.evaluate(() => VisualTweaksEditor.diagnostics());
async function ready() {
  await page.waitForFunction(
    () => window.VisualTweaksEditor?.diagnostics().ready === true,
    null,
    { timeout: 30000 },
  );
  await page.waitForLoadState("networkidle");
}
async function open(route = path) {
  await page.goto(base + route + "&vt-edit=1");
  await ready();
}
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = window.VisualTweaksConfig.editor;
      const url =
        method === "GET"
          ? `${cfg.api}${cfg.api.includes("?") ? "&" : "?"}page=${encodeURIComponent(body.page)}`
          : cfg.api;
      const r = await fetch(url, {
        method,
        headers: { "X-WP-Nonce": cfg.nonce, "Content-Type": "application/json" },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
      return { status: r.status, data: await r.json() };
    },
    { method, body },
  );
}
// Boucle du thème : passages par seconde et images natives par seconde, mesurés
// dans la page même. passages / images = nombre de boucles (1 ; 2 si doublée).
const loop = (target) =>
  target.evaluate(async () => {
    const raf = window.__vtRequestAnimationFrame || window.requestAnimationFrame;
    const t0 = performance.now(),
      k0 = window.__vtBenchTicks || 0;
    let frames = 0;
    await new Promise((resolve) => {
      const step = () => {
        frames++;
        if (performance.now() - t0 >= 1000) resolve();
        else raf(step);
      };
      raf(step);
    });
    const dt = (performance.now() - t0) / 1000;
    const ticks = ((window.__vtBenchTicks || 0) - k0) / dt;
    return {
      ticks: Math.round(ticks),
      frames: Math.round(frames / dt),
      loops: +(ticks / (frames / dt)).toFixed(2),
    };
  });
const single = (m) => m.loops >= 0.8 && m.loops <= 1.2 && m.ticks >= 20;
const state = () =>
  body().evaluate(() => {
    const video = document.querySelector("video");
    return {
      infinite: document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity)
        .map((a) => a.playState)
        .sort(),
      video: video ? { paused: video.paused, time: video.currentTime } : null,
      traces:
        document.querySelectorAll("[data-vt-light-paused]").length +
        !!document.getElementById("vt-light-mode"),
      nativeFrames:
        /\[native code\]/.test(String(window.requestAnimationFrame)) &&
        window.__vtRequestAnimationFrame === undefined,
    };
  });
const videoPlays = async () => {
  const a = await state();
  await page.waitForTimeout(400);
  const b = await state();
  return !!b.video && !b.video.paused && b.video.time !== a.video.time;
};
const toggle = async (expected) => {
  await ui("#light-mode").click();
  assert.equal(
    await ui("#light-mode").getAttribute("aria-pressed"),
    String(expected),
  );
};
// Styles retouchables qui ne dépendent pas des animations du thème.
const STATIC = [
  "translate",
  "font-size",
  "font-weight",
  "color",
  "width",
  "height",
  "margin-top",
  "margin-left",
  "padding-top",
  "padding-left",
  "display",
  "position",
  "background-color",
  "border-radius",
];
const staticStyles = (locatorRoot) =>
  locatorRoot.evaluate((root, props) => {
    const out = {};
    for (const n of root.querySelectorAll("[data-vt-id]")) {
      const s = getComputedStyle(n);
      out[n.getAttribute("data-vt-id")] = props.map((p) => s.getPropertyValue(p));
    }
    return out;
  }, STATIC);

await mkdir("artifacts", { recursive: true });
try {
  // Connexion vers l'accueil, pas le tableau de bord : quitter celui-ci aussitôt
  // interrompt ses requêtes (test de compression, actualités), que WebKit sous
  // Linux signale comme erreurs de page, en 0.4.4 comme en 0.4.5 (0.4.5, CI).
  await page.goto(
    base + "/wp-login.php?redirect_to=" + encodeURIComponent(base + "/"),
  );
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
  await open();
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("visual-tweaks")) localStorage.removeItem(key);
  });
  const page0 = path;
  const old = (await api("GET", { page: page0 })).data;
  await api("PUT", { page: page0, revision: old.revision, elements: [] });
  await open();
  // Deux retouches publiées sur cette page (titre déplacé, intertitre décalé).
  for (const [id, key, n] of [
    ["anim-title", "ArrowDown", 4],
    ["anim-temoignages", "ArrowRight", 3],
  ]) {
    await frame()
      .locator(`[data-vt-id="${id}"]`)
      .click({ position: { x: 4, y: 4 }, force: true });
    await page.waitForFunction(
      () => !!VisualTweaksEditor.diagnostics().selected,
    );
    for (let i = 0; i < n; i++) await page.keyboard.press(key);
  }
  await ui("#save").click();
  await ui("#state").filter({ hasText: /^Enregistré$/ }).waitFor();
  const saved = (await api("GET", { page: page0 })).data;
  assert.equal(saved.elements.length, 2);

  // 1. Bascules répétées.
  const live = { loop: await loop(body()), ...(await state()) };
  assert.ok(single(live.loop), `une boucle active : ${JSON.stringify(live.loop)}`);
  assert.ok(live.infinite.length >= 3 && live.infinite.every((s) => s === "running"));
  const playable = await videoPlays();
  if (!playable)
    notes.push(`${engine} : vidéo WebM non lue par ce moteur (contrôle vidéo non applicable)`);
  for (let cycle = 1; cycle <= 4; cycle++) {
    await toggle(true);
    const on = { loop: await loop(body()), ...(await state()) };
    assert.ok(on.loop.ticks <= 6, `cycle ${cycle} : boucle ralentie ${JSON.stringify(on.loop)}`);
    assert.ok(on.infinite.every((s) => s === "paused"), `cycle ${cycle} : ${on.infinite}`);
    if (playable) assert.equal(on.video.paused, true);
    await toggle(false);
    const off = { loop: await loop(body()), ...(await state()) };
    assert.ok(
      single(off.loop),
      `cycle ${cycle} : boucle rétablie sans doublon ${JSON.stringify(off.loop)}`,
    );
    assert.ok(off.infinite.every((s) => s === "running"));
    assert.equal(off.traces, 0);
    assert.equal(off.nativeFrames, true);
    if (playable) assert.equal(await videoPlays(), true);
  }
  record(
    `4 bascules : boucle ${live.loop.ticks}/s → ≤ 6/s → une seule boucle à pleine cadence (passages/images ${live.loop.loops}) ; animations infinies${playable ? " et vidéo" : ""} en pause puis relancées ; aucune trace laissée`,
  );

  // 2. Entrée et révélations en mode allégé (préférence active dès l'ouverture).
  await toggle(true);
  await page.reload();
  await ready();
  assert.equal((await diagnostics()).lightMode.active, true);
  await body().evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  assert.equal(
    await frame().locator('[data-vt-id="anim-entree"]').evaluate((n) => getComputedStyle(n).opacity),
    "1",
  );
  await frame().locator('[data-vt-id="anim-reveal-kf"]').evaluate((n) =>
    n.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(1500);
  const revealed = await body().evaluate(() => ({
    keyframes: getComputedStyle(document.querySelector(".anim-reveal-kf")).opacity,
    visible: document.querySelector(".anim-reveal-kf").classList.contains("is-visible"),
    transitions: [...document.querySelectorAll(".anim-reveal.is-visible")].map(
      (n) => getComputedStyle(n).opacity,
    ),
    header: document.querySelector(".anim-header").classList.contains("is-scrolled"),
  }));
  assert.equal(revealed.visible, true);
  assert.equal(revealed.keyframes, "1");
  assert.ok(revealed.transitions.length && revealed.transitions.every((o) => o === "1"));
  assert.equal(revealed.header, true);
  await body().evaluate(() => window.scrollTo(0, 0));
  record(
    "Mode allégé : animation d'entrée et révélations (animation et transition) terminées, en-tête suit le défilement : rien n'est figé",
  );

  // 3. Sélection, contour, déplacement et annulation en mode allégé.
  const title = frame().locator('[data-vt-id="anim-title"]');
  await title.click({ position: { x: 4, y: 4 }, force: true });
  await page.waitForFunction(() => !!VisualTweaksEditor.diagnostics().selected);
  const outlineMatches = async () => {
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const { displayedBox: box } = await page.evaluate(() =>
      VisualTweaksViewport.diagnostics(),
    );
    const outline = await ui(".outline.selected").boundingBox();
    return (
      !!outline &&
      Math.abs(outline.x - box.left) <= 3 &&
      Math.abs(outline.y - box.top) <= 3 &&
      Math.abs(outline.width - box.width) <= 4 &&
      Math.abs(outline.height - box.height) <= 4
    );
  };
  assert.ok(await outlineMatches(), "contour sur l'élément");
  const translateOf = () => title.evaluate((n) => getComputedStyle(n).translate);
  const before = await translateOf();
  const handle = await ui(".outline.selected .drag").boundingBox();
  const hx = handle.x + handle.width / 2,
    hy = handle.y + handle.height / 2;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 30, hy + 20, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === true);
  assert.notEqual(await translateOf(), before);
  assert.ok(await outlineMatches(), "contour suit le déplacement");
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowRight");
  assert.ok(await outlineMatches(), "contour suit le clavier");
  await ui("#undo").click();
  await ui("#undo").click();
  await page.waitForFunction(() => VisualTweaksEditor.diagnostics().dirty === false);
  assert.equal(await translateOf(), before);
  record(
    "Mode allégé : sélection, contour exact, déplacement à la souris et au clavier, annulation jusqu'à l'état enregistré",
  );

  // 4. Navigation entre pages : préférence conservée, puis retirée.
  await open(other);
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), "true");
  assert.ok((await loop(body())).ticks <= 6);
  await toggle(false);
  assert.ok(single(await loop(body())));
  await open();
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), "false");
  assert.ok(single(await loop(body())));
  record("Navigation entre pages : préférence conservée, retirée partout une fois désactivée");

  // 5. Onglet masqué (simulé), puis réellement en arrière-plan, et retour.
  await toggle(true);
  const setHidden = (hidden) =>
    page.evaluate((hidden) => {
      const docs = [
        document,
        document.querySelector("#vt-editor-host").shadowRoot.querySelector("iframe")
          .contentDocument,
      ];
      for (const doc of docs) {
        if (hidden)
          Object.defineProperty(doc, "visibilityState", {
            configurable: true,
            get: () => "hidden",
          });
        else delete doc.visibilityState;
      }
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await setHidden(true);
  await page.waitForTimeout(800);
  await setHidden(false);
  assert.ok((await loop(body())).ticks <= 6);
  const second = await context.newPage();
  await second.goto("about:blank");
  await second.bringToFront();
  await page.waitForTimeout(1500);
  await page.bringToFront();
  await second.close();
  assert.ok((await loop(body())).ticks <= 6, "toujours allégé au retour");
  assert.ok((await state()).infinite.every((s) => s === "paused"));
  await toggle(false);
  const restored = { loop: await loop(body()), ...(await state()) };
  assert.ok(single(restored.loop), `retour : ${JSON.stringify(restored.loop)}`);
  assert.ok(restored.infinite.every((s) => s === "running"));
  if (playable) assert.equal(await videoPlays(), true);
  record("Onglet masqué puis réaffiché : mode conservé, puis rendu animé rétabli sans boucle doublée");

  // 6. Données et site public inchangés ; éditeur (allégé ou non) = public.
  assert.deepEqual((await api("GET", { page: page0 })).data.elements, saved.elements);
  assert.equal((await diagnostics()).dirty, false);
  // Même largeur logique que l'écran Desktop de l'éditeur (1440 px), haut de page.
  await body().evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const editorLive = await staticStyles(body());
  await toggle(true);
  const editorLight = await staticStyles(body());
  await toggle(false);
  const frameSize = await body().evaluate(() => [innerWidth, innerHeight]);
  const visitor = await browser.newContext({
    viewport: { width: frameSize[0], height: frameSize[1] },
  });
  const pub = await visitor.newPage();
  const requests = [];
  pub.on("request", (r) => requests.push(r.url()));
  await pub.goto(base + path);
  await pub.waitForFunction(() => !!window.VisualTweaksRuntime);
  await pub.waitForTimeout(1500);
  const publicStyles = await staticStyles(pub.locator("body"));
  const publicState = await pub.evaluate(() => ({
    traces:
      document.querySelectorAll("[data-vt-light-paused]").length +
      !!document.getElementById("vt-light-mode"),
    infinite: document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity)
      .every((a) => a.playState === "running"),
  }));
  const publicLoop = await loop(pub.locator("body"));
  await visitor.close();
  assert.equal(publicState.traces, 0);
  assert.equal(publicState.infinite, true);
  assert.ok(single(publicLoop), `public : ${JSON.stringify(publicLoop)}`);
  const vtModules = requests
    .filter((u) => /plugins\/visual-tweaks\/assets\//.test(u))
    .map((u) => u.split("/assets/")[1].split("?")[0])
    .sort();
  assert.deepEqual(vtModules, [
    "background-layers.js",
    "runtime.js",
    "selection.js",
    "styles.js",
  ]);
  for (const [id, values] of Object.entries(publicStyles)) {
    assert.deepEqual(editorLive[id], values, `éditeur = public : ${id}`);
    assert.deepEqual(editorLight[id], values, `éditeur allégé = public : ${id}`);
  }
  record(
    `Données enregistrées inchangées ; visiteur : 4 modules publics seulement, ni règle ni attribut du mode allégé, animations normales ; ${Object.keys(publicStyles).length} éléments × ${STATIC.length} styles identiques entre éditeur, éditeur allégé et public`,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `artifacts/allege-${engine}.json`,
    JSON.stringify({ engine, checks, notes, errors, coreErrors }, null, 2),
  );
  for (const note of notes) console.log("NOTE", note);
} catch (error) {
  await page
    .screenshot({ path: `artifacts/allege-${engine}-failure.png` })
    .catch(() => {});
  console.error(errors, notes);
  throw error;
} finally {
  await browser.close();
}
