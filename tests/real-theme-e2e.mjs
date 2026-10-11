import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const requireBrowser = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const engine = process.env.VT_ENGINE || "chromium";
const browserType = requireBrowser("playwright")[engine];
const browser = await browserType.launch({
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
  route = `/?vt-test=real-theme-${engine}`,
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const ui = (selector) => page.locator(`#vt-editor-host ${selector}`),
  frame = () => page.frameLocator("#vt-editor-host iframe");
async function ready() {
  await page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
}
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = window.VisualTweaksConfig.editor;
      const url =
        method === "GET"
          ? cfg.api +
            (cfg.api.includes("?") ? "&" : "?") +
            "page=" +
            encodeURIComponent(body.page)
          : cfg.api;
      const response = await fetch(url, {
        method,
        headers: {
          "X-WP-Nonce": cfg.nonce,
          "Content-Type": "application/json",
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    },
    { method, body },
  );
}
async function save() {
  await ui("#save").click();
  await ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
}
async function action(id) {
  await ui(`#context-toolbar [data-action="${id}"]`).click();
}
async function drag(locator, dx, dy) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + dx,
    rect.y + rect.height / 2 + dy,
    { steps: 8 },
  );
  await page.mouse.up();
}
await mkdir("artifacts", { recursive: true });
async function fontsReady() {
  await frame()
    .locator("body")
    .evaluate(() => document.fonts.ready);
}
async function metrics(locator) {
  return locator.evaluate((n) => {
    const r = n.getBoundingClientRect(),
      style = getComputedStyle(n);
    return {
      width: r.width,
      height: r.height,
      x: r.x + scrollX,
      y: r.y + scrollY,
      marginLeft: style.marginLeft,
      translate: style.translate,
      transform: style.transform,
    };
  });
}
function closeEnough(actual, expected, tolerance = 1) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
}
try {
  await page.goto(
    base + "/wp-login.php?redirect_to=" + encodeURIComponent(base + route),
  );
  await page.waitForTimeout(250); // WordPress login autofocus settles after 200 ms.
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  for (let attempt = 0; attempt < 3; attempt++) {
    if (
      (await page.locator("#user_login").inputValue()) === "vt-admin" &&
      (await page.locator("#user_pass").inputValue()) === "vt-local-only-9410"
    )
      break;
    await page.locator("#user_login").fill("vt-admin");
    await page.locator("#user_pass").fill("vt-local-only-9410");
  }
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
  await page.goto(base + route + "&vt-edit=1");
  await ready();
  await fontsReady();
  const old = await api("GET", { page: route });
  await api("PUT", { page: route, revision: old.data.revision, elements: [] });
  await page.reload();
  await ready();
  await fontsReady();
  const publicContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    pub = await publicContext.newPage();
  await pub.goto(base + route);
  await pub.evaluate(() => document.fonts.ready);
  const selectors = [
    ".v2-header",
    ".hero-copy",
    ".hero-intro",
    ".hero-device-composition",
  ];
  const before = [];
  for (const selector of selectors) {
    const editor = await metrics(frame().locator(selector)),
      real = await metrics(pub.locator(selector));
    for (const property of ["x", "y", "width", "height"])
      closeEnough(editor[property], real[property], 2);
    before.push({ selector, editor, real });
  }
  assert.equal(await frame().locator(".v2-nav").isVisible(), true);
  assert.equal(await frame().locator("#wpadminbar").count(), 0);
  record(
    `${engine}: isolated real PHP theme, local web fonts, header and hero layout match anonymous 1440px public page`,
  );
  const expectedAssets = await frame()
    .locator("body")
    .evaluate(async () => {
      return [...document.querySelectorAll("img,svg")].filter(
        (n) => n.localName === "img" || !n.parentElement.closest("svg"),
      ).length;
    });
  await ui("#assets-tab").click();
  const discovered = await ui("#inventory .asset-card").count();
  assert.ok(
    discovered >= expectedAssets,
    `${discovered} assets for ${expectedAssets} HTML/SVG visuals`,
  );
  assert.ok(discovered > 1);
  const bg = ui("#inventory .asset-card").filter({ hasText: "Image de fond" });
  const expectedBackgrounds = await frame()
    .locator("body")
    .evaluate(
      () =>
        [...document.querySelectorAll("body *")].filter((n) =>
          /url\(/.test(getComputedStyle(n).backgroundImage),
        ).length,
    );
  assert.ok((await bg.count()) >= expectedBackgrounds);
  const selectable = (await bg.count())
    ? bg.first()
    : ui("#inventory .asset-card").filter({ hasText: "Image ·" }).first();
  await selectable.evaluate(
    (card) => (card.closest(".asset-group").open = true),
  );
  await selectable
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
  assert.equal(await ui("#properties").isVisible(), true);
  await ui("#structure-tab").click();
  assert.equal(await ui(".structure-item.is-selected").count(), 1);
  assert.equal(await ui(".structure-item.is-selected").isVisible(), true);
  await page.screenshot({
    path: `artifacts/real-theme-navigation-${engine}.png`,
  });
  record(
    `${engine}: real-theme Assets discovers ${discovered} visuals (${expectedBackgrounds} CSS background elements); selection synchronizes Structure and properties`,
  );
  const target = frame().locator(".hero-intro");
  await target.click();
  for (let i = 0; i < 10; i++) await target.press("ArrowRight");
  await save();
  await page.reload();
  await ready();
  await fontsReady();
  await pub.reload();
  await pub.evaluate(() => document.fonts.ready);
  await pub.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".hero-intro")).translate ===
      "10px",
  );
  const editor = await metrics(target),
    real = await metrics(pub.locator(".hero-intro"));
  for (const property of ["x", "y", "width", "height"])
    closeEnough(editor[property], real[property], 2);
  record(
    `${engine}: real-theme nudge persists after refresh and matches public position`,
  );
  await target.click();
  await ui("#reset-element").click();
  await save();
  await page.reload();
  await ready();
  await fontsReady();
  const restored = await metrics(target),
    original = before.find((e) => e.selector === ".hero-intro").editor;
  for (const property of ["x", "y", "width", "height"])
    closeEnough(restored[property], original[property], 2);
  await ui('[data-mode="tablet"]').click();
  assert.equal(
    await frame()
      .locator("body")
      .evaluate(() => innerWidth),
    820,
  );
  await ui('[data-mode="mobile"]').click();
  assert.equal(
    await frame()
      .locator("body")
      .evaluate(() => innerWidth),
    390,
  );
  await ui('[data-mode="desktop"]').click();
  assert.equal(await frame().locator(".v2-nav").isVisible(), true);
  record(
    `${engine}: real-theme reset restores original geometry and logical responsive viewports`,
  );
  assert.deepEqual(errors, []);
  await publicContext.close();
  await page.screenshot({ path: `artifacts/real-theme-${engine}.png` });
  await writeFile(
    `artifacts/real-theme-${engine}-report.json`,
    JSON.stringify(
      {
        engine,
        version: browser.version(),
        checks,
        before,
        edited: { editor, real },
        restored,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: `artifacts/real-theme-${engine}-failure.png` });
  throw error;
} finally {
  await browser.close();
}
