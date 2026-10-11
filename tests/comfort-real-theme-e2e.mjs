import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
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
    viewport: { width: 1400, height: 1000 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9411",
  route = `/?vt-test=comfort-real-${engine}`,
  checks = [],
  errors = [];
const ui = (s) => page.locator("#vt-editor-host " + s),
  frame = () => page.frameLocator("#vt-editor-host iframe");
page.on("pageerror", (e) => errors.push(e.message));
const record = (text) => {
  checks.push(text);
  console.log("PASS", text);
};
const ready = () =>
  page.waitForFunction(() => VisualTweaksEditor?.diagnostics().ready);
const clean = () =>
  ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
const dirty = () =>
  ui("#state")
    .filter({ hasText: /^Modifications non enregistrées$/ })
    .waitFor();
const local = () =>
  page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        `visual-tweaks:${location.origin}:${VisualTweaksConfig.editor.userId}:${VisualTweaksConfig.page}`,
      ),
    ),
  );
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = VisualTweaksConfig.editor;
      const r = await fetch(
        cfg.api +
          (method === "GET" ? "?page=" + encodeURIComponent(body.page) : ""),
        {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": cfg.nonce,
          },
          ...(method === "PUT" ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: r.status, data: await r.json() };
    },
    { method, body },
  );
}
const geometry = (n) => {
  const box = n.getBoundingClientRect();
  return {
    x: box.x + scrollX,
    y: box.y + scrollY,
    width: box.width,
    height: box.height,
  };
};
try {
  await page.goto(
    base +
      "/wp-login.php?redirect_to=" +
      encodeURIComponent(base + route + "&vt-edit=1"),
  );
  await page.waitForTimeout(250);
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
  await ready();
  const original = await api("GET", { page: route });
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: original.data.revision,
        elements: [],
      })
    ).status,
    200,
  );
  await page.reload();
  await ready();
  await frame()
    .locator("body")
    .evaluate(() => document.fonts.ready);
  const target = frame().locator(".hero-intro");
  await target.click();
  await target.press("ArrowRight");
  await dirty();
  const before = await local(),
    selected = await page.evaluate(
      () => VisualTweaksEditor.diagnostics().selected,
    ),
    viewport = await page.evaluate(
      () => VisualTweaksViewport.diagnostics().logicalViewport,
    );
  await ui("#test-responsive").click();
  await ui('#responsive-report [data-screen="mobile"]').waitFor();
  const responsive = await page.evaluate(
    () => VisualTweaksEditor.diagnostics().responsive,
  );
  assert.equal(responsive.stale, false);
  assert.deepEqual(
    responsive.screens.map((s) => s.width),
    [1440, 820, 390],
  );
  assert.deepEqual(await local(), before);
  assert.equal(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().selected),
    selected,
  );
  assert.deepEqual(
    await page.evaluate(
      () => VisualTweaksViewport.diagnostics().logicalViewport,
    ),
    viewport,
  );
  assert.equal(await frame().locator(".v2-nav").isVisible(), true);
  await ui("#responsive-report")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  record(
    `${engine}: thème PHP réel, audit des trois écrans sans mutation ; sélection, draft, viewport et navigation desktop restaurés`,
  );
  await ui("#review-button").click();
  assert.equal(await ui("#review-changes article").count(), 1);
  await ui("#review-changes article")
    .getByRole("button", { name: "Voir", exact: true })
    .click();
  assert.equal(await ui(".structure-item.is-selected").count(), 1);
  await ui("#interaction-browse").click();
  await target.click();
  assert.deepEqual(await local(), before);
  await ui("#interaction-edit").click();
  assert.equal(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().selected),
    selected,
  );
  await ui("#undo").click();
  await clean();
  await target.press("ArrowRight");
  await dirty();
  await ui("#save").click();
  await clean();
  await page.reload();
  await ready();
  await frame()
    .locator("body")
    .evaluate(() => document.fonts.ready);
  assert.equal(
    await target.evaluate((n) => getComputedStyle(n).translate.split(" ")[0]),
    "1px",
  );
  record(
    `${engine}: Modifications et Naviguer sur le thème réel conservent le state ; Undo/save/refresh fonctionnent`,
  );
  const anonymous = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    pub = await anonymous.newPage();
  await pub.goto(base + route);
  await pub.waitForFunction(() => !!VisualTweaksRuntime);
  await pub.evaluate(() => document.fonts.ready);
  const editorBox = await target.evaluate(geometry),
    publicBox = await pub.locator(".hero-intro").evaluate(geometry);
  for (const key of Object.keys(editorBox))
    assert.ok(
      Math.abs(editorBox[key] - publicBox[key]) < 2,
      `${key}: ${editorBox[key]} / ${publicBox[key]}`,
    );
  assert.equal(await pub.locator("#vt-editor-host").count(), 0);
  await anonymous.close();
  record(
    `${engine}: retouche après audit et sauvegarde identique au rendu public à 1440px`,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `artifacts/comfort-real-${engine}.png` });
  await writeFile(
    `artifacts/comfort-real-${engine}.json`,
    JSON.stringify(
      { engine, checks, errors, responsive, editorBox, publicBox },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({
    path: `artifacts/comfort-real-${engine}-failure.png`,
  });
  throw error;
} finally {
  await browser.close();
}
