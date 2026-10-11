import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
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
const context = await browser.newContext({
    viewport: { width: 1560, height: 1050 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9410",
  route = `/?vt-test=ergonomics-speed-${engine}`,
  checks = [],
  errors = [];
const ui = (s) => page.locator(`#vt-editor-host ${s}`),
  frame = () => page.frameLocator("#vt-editor-host iframe"),
  hero = () => frame().locator('[data-vt-id="hero-title"]');
page.on("pageerror", (e) => errors.push(e.stack));
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const ready = () =>
  page.waitForFunction(
    () => window.VisualTweaksEditor?.diagnostics().ready === true,
  );
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = VisualTweaksConfig.editor;
      const res = await fetch(
        cfg.api +
          (method === "GET"
            ? (cfg.api.includes("?") ? "&" : "?") +
              "page=" +
              encodeURIComponent(body.page)
            : ""),
        {
          method,
          headers: {
            "X-WP-Nonce": cfg.nonce,
            "Content-Type": "application/json",
          },
          ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        },
      );
      return { status: res.status, data: await res.json() };
    },
    { method, body },
  );
}
const dirty = () =>
  ui("#state")
    .filter({ hasText: /^Modifications non enregistrées$/ })
    .waitFor();
const clean = () =>
  ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
const local = () =>
  page.evaluate(() => {
    const cfg = VisualTweaksConfig;
    return JSON.parse(
      localStorage.getItem(
        `visual-tweaks:${location.origin}:${cfg.editor.userId}:${cfg.page}`,
      ),
    );
  });
try {
  await page.goto(
    base +
      "/wp-login.php?redirect_to=" +
      encodeURIComponent(base + route + "&vt-edit=1"),
  );
  await page.waitForTimeout(250); // WordPress login autofocus settles after 200 ms.
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
  await ready();
  const initial = await api("GET", { page: route });
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: initial.data.revision,
        elements: [],
      })
    ).status,
    200,
  );
  await page.reload();
  await ready();
  await ui("#assets-tab").click();
  const counters = await page.evaluate(
    () => VisualTweaksEditor.diagnostics().navigation,
  );
  for (let i = 0; i < 5; i++) {
    await ui("#structure-tab").click();
    await hero().click();
    await ui("#assets-tab").click();
  }
  assert.deepEqual(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().navigation),
    counters,
  );
  assert.equal(await local(), null);
  record(
    "Navigation et sélection répétées : aucun nouveau scan Structure/Assets ni override",
  );
  await ui("#structure-tab").click();
  const structureBuilds = await page.evaluate(
    () => VisualTweaksEditor.diagnostics().navigation.structureBuilds,
  );
  for (const mode of ["tablet", "mobile", "desktop"])
    await ui(`[data-mode="${mode}"]`).click();
  assert.equal(
    await page.evaluate(
      () => VisualTweaksEditor.diagnostics().navigation.structureBuilds,
    ),
    structureBuilds,
  );
  record(
    "Responsive : Structure conserve son index et ses lignes sans reconstruction",
  );
  const phone = frame().locator('[data-vt-id="hero-phone"]');
  await phone.click();
  await phone.evaluate(async (n) => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((n) => !n.complete)
        .map(
          (n) =>
            new Promise((resolve) => {
              n.addEventListener("load", resolve, { once: true });
              n.addEventListener("error", resolve, { once: true });
            }),
        ),
    );
  });
  await phone.evaluate(() => {
    window._vtRenderCalls = 0;
    const runtime = VisualTweaksRuntime,
      original = runtime.render;
    runtime.render = function (...args) {
      window._vtRenderCalls++;
      return original.apply(this, args);
    };
  });
  let puts = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("visual-tweaks")) puts++;
  });
  const box = await ui(".drag").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 35,
    box.y + box.height / 2 + 10,
    { steps: 20 },
  );
  await frame().locator("#vt-gesture-styles").waitFor({ state: "attached" });
  assert.equal(await phone.evaluate(() => window._vtRenderCalls), 0);
  assert.equal(await local(), null);
  assert.equal(puts, 0);
  await page.mouse.up();
  await dirty();
  assert.equal(await phone.evaluate(() => window._vtRenderCalls), 1);
  assert.equal(puts, 0);
  await ui("#undo").click();
  await clean();
  assert.equal(await local(), null);
  record(
    "Drag : feuille temporaire ciblée, zéro rendu complet/state/REST pendant le geste, une mutation finale annulable",
  );
  await phone.click();
  await phone.press("ArrowRight");
  const renderCount = await phone.evaluate(() => window._vtRenderCalls);
  const logicalX = await phone.evaluate((n) => n.getBoundingClientRect().x);
  for (let i = 0; i < 4; i++) await phone.press("ArrowRight");
  assert.equal(await phone.evaluate(() => window._vtRenderCalls), renderCount);
  assert.equal(
    (await local()).elements.find((e) => e.id === "hero-phone").changes.desktop
      .translateX,
    "5px",
  );
  assert.ok(
    Math.abs(
      (await phone.evaluate((n) => n.getBoundingClientRect().x)) - logicalX - 4,
    ) < 1,
  );
  assert.ok(
    (await page.evaluate(
      () => VisualTweaksEditor.diagnostics().rendering.stylePatches,
    )) >= 4,
  );
  await ui("#undo").click();
  await clean();
  record(
    "Petites retouches CSS : règles ciblées, aucun rendu complet répétitif, pixels logiques et undo conservés",
  );
  await ui("#assets-tab").click();
  const before = await page.evaluate(
    () => VisualTweaksEditor.diagnostics().navigation.assetScans,
  );
  await phone.evaluate(() => {
    const n = document.createElement("img");
    n.src = document.querySelector("img").src;
    n.setAttribute("data-vt-id", "speed-added");
    n.alt = "Visuel ajouté tardivement";
    n.width = 40;
    n.height = 40;
    document.body.append(n);
  });
  await ui('.asset-card[data-asset-id="speed-added"]').waitFor();
  assert.equal(
    await page.evaluate(
      () => VisualTweaksEditor.diagnostics().navigation.assetScans,
    ),
    before,
  );
  await ui('.asset-card[data-asset-id="speed-added"]')
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
  assert.equal(await ui("#properties").isVisible(), true);
  await ui("#structure-tab").click();
  assert.equal(
    await ui('.structure-item[data-asset-id="speed-added"]').getAttribute(
      "aria-selected",
    ),
    "true",
  );
  await frame()
    .locator('[data-vt-id="speed-added"]')
    .evaluate((n) => n.remove());
  await ui('.structure-item[data-asset-id="speed-added"]').waitFor({
    state: "detached",
  });
  assert.equal(await local(), null);
  record(
    "MutationObserver : asset ajouté/découvert/sélectionné puis retiré, sans nouveau scan global des assets",
  );
  assert.deepEqual(errors, []);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/speed-${engine}.json`,
    JSON.stringify({ engine, checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
