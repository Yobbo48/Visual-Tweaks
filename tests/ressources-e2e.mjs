// 0.4.5 — ressources de l'éditeur, sur la page de banc animée (?vt-test=animated) :
// boucle requestAnimationFrame qui écrit des styles à chaque image, animations
// CSS infinies, diaporama (classes), bandeau qui déplace un élément du DOM.
// Vérifie que l'éditeur ne travaille que lorsque c'est utile, sans rien perdre :
//   1. document hôte sans le thème (le thème ne tourne que dans l'aperçu) ;
//   2. Navigation : une animation continue ne bloque plus les mises à jour et ne
//      reconstruit pas le panneau Assets quand l'inventaire ne change pas ;
//   3. Structure : seule la branche modifiée est reconstruite, dans l'ordre du DOM ;
//   4. onglet ou panneau masqué : rien n'est traité, tout est rattrapé au retour ;
//   5. édition allégée : réversible, sans effet sur les retouches, préférence
//      conservée, test responsive fonctionnel.
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const engine = process.env.VT_ENGINE || "chromium";
const browser = await require("playwright")[engine].launch({
  headless: true,
  ...(engine === "chromium" && process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
});
const base = "http://127.0.0.1:9410";
const path = `/?vt-test=animated-ressources-${engine}`;
const coreErrors = [];
const isCoreRejection = (e) =>
  /^(\[object Object\]|Object)$/.test(e.message) &&
  (/wp-includes\/js\/dist\/preferences/.test(e.stack || "") ||
    (engine === "firefox" && !/https?:\/\//.test(e.stack || "")));
const checks = [],
  errors = [];
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
const navigation = async () => (await diagnostics()).navigation;
async function ready() {
  await page.waitForFunction(
    () => window.VisualTweaksEditor?.diagnostics().ready === true,
    null,
    { timeout: 30000 },
  );
  await page.waitForLoadState("networkidle");
}
async function open() {
  await page.goto(base + path + "&vt-edit=1");
  await ready();
}
// Changes of the first rune per second: the theme's animation loop rate.
const loopRate = () =>
  body().evaluate(async () => {
    const rune = document.querySelector("[data-vt-rune]");
    let last = rune.style.transform,
      changes = 0;
    const start = performance.now();
    while (performance.now() - start < 1000) {
      await new Promise((r) => setTimeout(r, 8));
      if (rune.style.transform !== last) {
        changes++;
        last = rune.style.transform;
      }
    }
    return changes;
  });
const playStates = () =>
  body().evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.animationName)
      .map((a) => `${a.animationName}:${a.playState}`)
      .sort(),
  );
async function setHidden(hidden) {
  await page.evaluate((hidden) => {
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
}
const addImage = (id) =>
  body().evaluate((n, id) => {
    const img = document.createElement("img");
    img.src = document.querySelector("img").src;
    img.alt = "Ajout " + id;
    img.width = 40;
    img.height = 40;
    img.setAttribute("data-vt-id", id);
    n.append(img);
  }, id);

await mkdir("artifacts", { recursive: true });
try {
  await page.goto(base + "/wp-login.php");
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

  // 1. Document hôte.
  const host = await page.evaluate(() => ({
    theme: !!document.querySelector(".anim-hero, [data-vt-rune]"),
    themeScripts: [...document.scripts].filter((s) => /\/themes\//.test(s.src))
      .length,
    runtime: !!window.VisualTweaksRuntime,
    media: typeof window.wp?.media,
    editorModule: [...document.scripts].some(
      (s) => s.type === "module" && /assets\/editor\.js\?ver=/.test(s.src),
    ),
  }));
  assert.deepEqual(host, {
    theme: false,
    themeScripts: 0,
    runtime: false,
    media: "function",
    editorModule: true,
  });
  assert.ok((await loopRate()) >= 30, "le thème s'anime dans l'aperçu");
  assert.equal(
    await body().evaluate(() => !!window.VisualTweaksRuntime),
    true,
  );
  record(
    "Document hôte : ni gabarit ni script du thème, médiathèque disponible ; le thème tourne dans l'aperçu avec le runtime",
  );

  // 2. Navigation sous animation continue.
  await ui("#assets-tab").click();
  const n0 = await navigation();
  await page.waitForTimeout(1500);
  const n1 = await navigation();
  assert.equal(n1.viewRebuilds, n0.viewRebuilds);
  assert.equal(n1.assetScans, n0.assetScans);
  assert.ok(n1.assetUpdates > n0.assetUpdates, "mises à jour non bloquées");
  await addImage("ressources-ajout");
  await ui('.asset-card[data-asset-id="ressources-ajout"]').waitFor({
    state: "attached",
    timeout: 2000,
  });
  record(
    "Navigation : l'animation continue ne bloque plus les mises à jour (asset ajouté visible) et ne reconstruit pas Assets sans changement",
  );

  // 3. Branche de Structure (bandeau qui déplace un élément toutes les 4 s).
  await ui("#structure-tab").click();
  const s0 = await navigation();
  await page.waitForTimeout(4600);
  const s1 = await navigation();
  assert.equal(s1.structureBuilds, s0.structureBuilds);
  assert.ok(s1.structureBranches > s0.structureBranches);
  // The ticker may move again just before the check: its update follows within 250 ms.
  await page.waitForFunction(
    () => {
      const ui = document.querySelector("#vt-editor-host").shadowRoot;
      const ticker = ui
        .querySelector("iframe")
        .contentDocument.querySelector(".anim-ticker");
      const dom = [...ticker.children].map((n) => n.textContent.trim());
      const rows = [...ui.querySelectorAll(".structure-item small")]
        .map((n) => n.textContent.trim())
        .filter((t) => dom.includes(t));
      return rows.join("|") === dom.join("|");
    },
    null,
    { timeout: 1000, polling: 50 },
  );
  await body().evaluate(() =>
    document.querySelector('[data-vt-id="ressources-ajout"]').remove(),
  );
  await ui('.structure-item[data-asset-id="ressources-ajout"]').waitFor({
    state: "detached",
    timeout: 2000,
  });
  record(
    "Structure : seule la branche modifiée est reconstruite, dans l'ordre du DOM ; un retrait est reflété",
  );

  // 4. Onglet masqué, puis panneau fermé.
  await ui("#assets-tab").click();
  await setHidden(true);
  const h0 = await navigation();
  await addImage("ressources-masque");
  await page.waitForTimeout(900);
  const h1 = await navigation();
  assert.equal(h1.assetUpdates, h0.assetUpdates, "rien en arrière-plan");
  assert.equal(
    await ui('.asset-card[data-asset-id="ressources-masque"]').count(),
    0,
  );
  await setHidden(false);
  await ui('.asset-card[data-asset-id="ressources-masque"]').waitFor({
    state: "attached",
    timeout: 1000,
  });
  await ui("#close-navigation").click();
  const p0 = await navigation();
  await addImage("ressources-panneau");
  await page.waitForTimeout(900);
  assert.equal((await navigation()).assetUpdates, p0.assetUpdates);
  await ui("#toggle-navigation").click();
  await ui('.asset-card[data-asset-id="ressources-panneau"]').waitFor({
    state: "attached",
    timeout: 1000,
  });
  record(
    "Onglet ou panneau masqué : aucune mise à jour pendant l'absence, tout est rattrapé au retour",
  );

  // 5. Édition allégée.
  const tweaked = () =>
    frame()
      .locator('[data-vt-id="anim-title"]')
      .evaluate((n) => {
        const s = getComputedStyle(n);
        return [s.translate, s.fontSize, s.color, n.getBoundingClientRect().height];
      });
  const live = { rate: await loopRate(), states: await playStates() };
  const before = await tweaked();
  assert.ok(live.states.every((s) => s.endsWith(":running")));
  await ui("#light-mode").click();
  assert.equal(await ui("#light-mode").getAttribute("aria-pressed"), "true");
  const light = { rate: await loopRate(), states: await playStates() };
  assert.ok(light.rate <= 6, `boucle ralentie (${light.rate}/s)`);
  assert.ok(light.states.every((s) => s.endsWith(":paused")));
  assert.deepEqual(await tweaked(), before);
  // The responsive test uses native frames: it completes in light mode.
  await ui("#test-responsive").click();
  await page.waitForFunction(
    () => VisualTweaksEditor.diagnostics().responsive.audits > 0 &&
      !VisualTweaksEditor.diagnostics().responsive.busy,
    null,
    { timeout: 15000 },
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await ready();
  assert.equal((await diagnostics()).lightMode.active, true);
  assert.ok((await loopRate()) <= 6);
  await ui("#light-mode").click();
  const back = { rate: await loopRate(), states: await playStates() };
  assert.ok(back.rate >= 30, `rendu animé rétabli (${back.rate}/s)`);
  assert.deepEqual(back.states, live.states);
  assert.equal(
    await body().evaluate(
      () =>
        document.querySelectorAll("[data-vt-light-paused]").length +
        !!document.getElementById("vt-light-mode"),
    ),
    0,
  );
  assert.deepEqual(await tweaked(), before);
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("visual-tweaks-light")),
    ),
    false,
  );
  assert.equal((await diagnostics()).dirty, false);
  record(
    "Édition allégée : boucle du thème ralentie, animations infinies en pause, retouches inchangées, test responsive fonctionnel, préférence conservée, retour exact au rendu animé",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `artifacts/ressources-${engine}.json`,
    JSON.stringify({ engine, checks, errors, coreErrors }, null, 2),
  );
} catch (error) {
  await page
    .screenshot({ path: `artifacts/ressources-${engine}-failure.png` })
    .catch(() => {});
  console.error(errors);
  throw error;
} finally {
  await browser.close();
}
