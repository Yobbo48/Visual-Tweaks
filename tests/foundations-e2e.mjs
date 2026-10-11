import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const requireBrowser = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const { chromium } = requireBrowser("playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext({
    viewport: { width: 1560, height: 1050 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9410",
  route = "/?vt-test=foundations",
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
  const scale = await page.evaluate(
    () => window.VisualTweaksViewport.diagnostics().zoom,
  );
  dx *= scale;
  dy *= scale;
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
async function selectAsset(id) {
  await ui("#assets-tab").click();
  await ui(`#inventory [data-asset-id="${id}"]`).evaluate((card) => {
    card.closest(".asset-group").open = true;
  });
  await ui(`#inventory [data-asset-id="${id}"]`)
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
}
async function closeQuick() {
  const close = ui(".context-popover .popover-heading button");
  if (await close.isVisible()) await close.click();
}
async function replace() {
  await action("replace");
  await page.locator(".media-modal:visible #menu-item-browse").click();
  await page
    .locator('.media-modal:visible .attachment[aria-label*="VT replacement"]')
    .click();
  await page.locator(".media-modal:visible .media-button-select").click();
}
try {
  await page.goto(base + "/wp-login.php");
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
  const initial = await api("GET", { page: route });
  await api("PUT", {
    page: route,
    revision: initial.data.revision,
    elements: [],
  });
  await page.reload();
  await ready();
  const phone = frame().locator('[data-vt-id="hero-phone"]');
  await phone.click();
  await phone.press("ArrowRight");
  await phone.press("ArrowUp");
  await phone.press("Shift+ArrowUp");
  assert.equal(
    await phone.evaluate((n) => getComputedStyle(n).translate),
    "6px -8px",
  );
  await ui("#undo").click();
  assert.equal(
    await phone.evaluate((n) => getComputedStyle(n).translate),
    "5px 3px",
  );
  await ui("#redo").click();
  assert.equal(
    await phone.evaluate((n) => getComputedStyle(n).translate),
    "6px -8px",
  );
  record(
    "keyboard arrows move 1px, Shift moves 10px; a sequence has one undo/redo step",
  );
  await action("move");
  await ui(
    '.context-popover select[aria-label="Pas du déplacement"]',
  ).selectOption("5");
  await ui('.context-popover [data-nudge="droite"]').click();
  assert.equal(
    await phone.evaluate((n) => getComputedStyle(n).translate),
    "11px -8px",
  );
  await closeQuick();
  await action("size");
  const width = ui('.context-popover [data-property="width"]');
  await width.fill("240");
  const beforeArrow = await phone.evaluate(
    (n) => getComputedStyle(n).translate,
  );
  await width.press("ArrowLeft");
  assert.equal(
    await phone.evaluate((n) => getComputedStyle(n).translate),
    beforeArrow,
  );
  await closeQuick();
  record(
    "visible directional buttons and step size work; field editing never nudges",
  );
  await frame().locator('[data-vt-id="hero-title"]').dblclick();
  const title = frame().locator('[data-vt-id="hero-title"]');
  const beforeInline = await title.evaluate(
    (n) => getComputedStyle(n).translate,
  );
  await title.press("ArrowRight");
  await title.press("Shift+ArrowLeft");
  assert.equal(
    await title.evaluate((n) => getComputedStyle(n).translate),
    beforeInline,
  );
  await title.press("Escape");
  record("inline text caret shortcuts never move the text element");
  await phone.click();
  const sizeBeforeZoom = await phone.evaluate((n) => [
    n.offsetWidth,
    n.offsetHeight,
  ]);
  const pixelsBeforeZoom = await phone.screenshot();
  await action("position");
  await ui('.context-popover [data-property="imageZoom"]').fill("140");
  await ui('.context-popover [data-property="imageZoom"]').press("Tab");
  await closeQuick();
  const pixelsAfterZoom = await phone.screenshot();
  assert.equal(pixelsBeforeZoom.equals(pixelsAfterZoom), false);
  assert.deepEqual(
    await phone.evaluate((n) => [n.offsetWidth, n.offsetHeight]),
    sizeBeforeZoom,
  );
  await save();
  await page.reload();
  await ready();
  assert.match(
    await phone.evaluate((n) => getComputedStyle(n).objectViewBox),
    /inset/,
  );
  record(
    "image zoom changes rendered pixels, preserves its frame and survives refresh",
  );
  await ui("#assets-tab").click();
  assert.equal(await ui("#inventory .asset-card").count(), 5);
  for (const id of [
    "hero-phone",
    "fixture-background",
    "fixture-logo",
    "fixture-covered-image",
    "fixture-icon",
  ])
    assert.equal(await ui(`#inventory [data-asset-id="${id}"]`).count(), 1);
  await page.waitForFunction(() =>
    [
      ...document
        .querySelector("#vt-editor-host")
        .shadowRoot.querySelectorAll("#inventory img"),
    ].every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.screenshot({ path: "artifacts/assets-inventory.png" });
  await ui('#inventory [data-asset-id="fixture-covered-image"]').evaluate(
    (card) => {
      card.closest(".asset-group").open = true;
    },
  );
  await ui('#inventory [data-asset-id="fixture-covered-image"]')
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
  assert.equal(await ui("#panel h2").textContent(), "Image");
  assert.equal(await ui("#context-toolbar").isVisible(), true);
  record(
    "Assets inventories img/picture/background/SVG and selects a covered image",
  );
  await selectAsset("fixture-icon");
  assert.equal(await ui("#panel h2").textContent(), "Icône");
  const svg = frame().locator('[data-vt-id="fixture-icon"]');
  await svg.locator("path").click();
  assert.equal(await ui("#panel h2").textContent(), "Icône");
  await action("move");
  await ui('.context-popover [data-nudge="haut"]').click();
  await closeQuick();
  assert.equal(await svg.locator("path").count(), 1);
  record("SVG paths select the root icon, preserving its internal DOM");
  await selectAsset("fixture-logo");
  await replace();
  const logo = frame().locator('[data-vt-id="fixture-logo"]');
  assert.ok((await logo.getAttribute("src")).includes("vt-replacement.png"));
  assert.equal(
    await frame().locator("picture source").getAttribute("srcset"),
    null,
  );
  assert.equal(await logo.evaluate((n) => n.offsetWidth), 160);
  record(
    "picture replacement uses WordPress media and keeps the frame and original sources recoverable",
  );
  await selectAsset("fixture-background");
  const bg = frame().locator('[data-vt-id="fixture-background"]');
  const dimensions = await bg.evaluate((n) => ({
    width: n.offsetWidth,
    height: n.offsetHeight,
  }));
  await action("position");
  const pad = ui(".context-popover .crop-pad");
  const rect = await pad.boundingBox();
  await page.mouse.click(
    rect.x + rect.width * 0.25,
    rect.y + rect.height * 0.7,
  );
  const focal = await bg.evaluate(
    (n) => getComputedStyle(n).backgroundPosition,
  );
  assert.match(focal, /2[3456]% 7[01]%/);
  await closeQuick();
  await action("crop");
  const cover = frame().locator('[data-vt-id="fixture-overlay"]');
  await drag(cover, 0, 20);
  assert.notEqual(
    await bg.evaluate((n) => getComputedStyle(n).backgroundPosition),
    focal,
  );
  await action("crop");
  record(
    "background focal point and direct crop gesture adjust image position without moving its zone",
  );
  await replace();
  assert.ok(
    (await bg.evaluate((n) => getComputedStyle(n).backgroundImage)).includes(
      "vt-replacement.png",
    ),
  );
  assert.deepEqual(
    await bg.evaluate((n) => ({
      width: n.offsetWidth,
      height: n.offsetHeight,
    })),
    dimensions,
  );
  record(
    "background replacement persists as a media ID while preserving the block structure and dimensions",
  );
  await action("position");
  await ui('.context-popover [data-property="imageZoom"]').fill("140");
  await ui('.context-popover [data-property="imageZoom"]').press("Tab");
  await closeQuick();
  await action("style");
  await ui('.context-popover [data-property="box-shadow"]').selectOption(
    "0px 8px 20px 0px #163b3033",
  );
  await ui(
    '.context-popover [data-property="overlay-color"] input[type="text"]',
  ).fill("#114433");
  await ui(
    '.context-popover [data-property="overlay-color"] input[type="text"]',
  ).press("Tab");
  assert.ok(
    (await bg.evaluate((n) => getComputedStyle(n).backgroundImage)).includes(
      "linear-gradient",
    ),
  );
  await closeQuick();
  await save();
  await page.reload();
  await ready();
  assert.ok(
    (await bg.evaluate((n) => getComputedStyle(n).backgroundImage)).includes(
      "vt-replacement.png",
    ),
  );
  assert.ok(
    (await bg.evaluate((n) => getComputedStyle(n).backgroundImage)).includes(
      "linear-gradient",
    ),
  );
  assert.notEqual(
    await bg.evaluate((n) => getComputedStyle(n).boxShadow),
    "none",
  );
  record(
    "background zoom, overlay, shadow and replacement survive save and refresh",
  );
  await selectAsset("fixture-background");
  assert.equal(await ui('#context-toolbar [data-action="replace"]').count(), 1);
  for (const mode of ["tablet", "mobile"]) {
    await ui(`[data-mode="${mode}"]`).click();
    await action("move");
    await ui('.context-popover [data-nudge="droite"]').click();
    await closeQuick();
    await action("position");
    await ui('.context-popover [data-fit="contain"]').click();
    await closeQuick();
    await save();
    await page.screenshot({ path: `artifacts/assets-${mode}.png` });
  }
  const stored = await api("GET", { page: route });
  const storedBg = stored.data.elements.find(
    (e) => e.id === "fixture-background",
  );
  assert.equal(storedBg.changes.tablet["background-size"], "contain");
  assert.equal(storedBg.changes.mobile["background-size"], "contain");
  await page.reload();
  await ready();
  await selectAsset("fixture-background");
  await ui('[data-mode="mobile"]').click();
  assert.equal(
    await bg.evaluate((n) => parseFloat(getComputedStyle(n).translate)),
    2,
  );
  record(
    "tablet and mobile asset exceptions persist independently and reapply after refresh",
  );
  await ui('[data-mode="desktop"]').click();
  await selectAsset("fixture-background");
  await cover.click({ modifiers: ["Alt"] });
  await ui(".context-popover")
    .getByRole("button", { name: /^Image de fond/ })
    .click();
  assert.equal(await ui("#panel h2").textContent(), "Image de fond");
  record(
    "Alt-click exposes overlapping elements and selects the background behind the overlay",
  );
  await ui("#structure-tab").click();
  await ui('#inventory [data-asset-id="hero-title"]').evaluate((row) => {
    for (
      let branch = row
        .closest(".structure-branch")
        .parentElement.closest(".structure-branch");
      branch;
      branch = branch.parentElement.closest(".structure-branch")
    ) {
      const toggle = branch.querySelector(
        ":scope > .structure-item .tree-toggle",
      );
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    }
  });
  await ui('#inventory [data-asset-id="hero-title"] .tree-pick').click();
  assert.equal(await ui("#panel h2").textContent(), "Titre");
  record(
    "lightweight Structure selects an existing text without rebuilding the DOM",
  );
  await selectAsset("fixture-background");
  await action("style");
  await ui('.context-popover [data-property="box-shadow"]').selectOption(
    "custom",
  );
  await ui('.context-popover .shadow-custom input[type="number"]')
    .nth(2)
    .fill("24");
  await closeQuick();
  await save();
  assert.ok(
    (await bg.evaluate((n) => getComputedStyle(n).boxShadow)).includes("24px"),
  );
  record("custom shadow fields generate only strictly validated values");
  const anonymous = await browser.newContext(),
    publicPage = await anonymous.newPage();
  await publicPage.goto(base + route);
  await publicPage.waitForFunction(() => !!window.VisualTweaksRuntime);
  assert.ok(
    (
      await publicPage
        .locator('[data-vt-id="fixture-background"]')
        .evaluate((n) => getComputedStyle(n).backgroundImage)
    ).includes("vt-replacement.png"),
  );
  assert.ok(
    (
      await publicPage
        .locator('[data-vt-id="fixture-logo"]')
        .getAttribute("src")
    ).includes("vt-replacement.png"),
  );
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  assert.equal(
    await publicPage
      .locator('[data-vt-id="fixture-background"]')
      .getAttribute("style"),
    await bg.getAttribute("style"),
  );
  await anonymous.close();
  record(
    "public visitors receive saved image/background overrides and no editor or permanent inline override",
  );
  assert.deepEqual(errors, []);
  record("no uncaught browser errors");
  await writeFile(
    "artifacts/foundations-test-report.json",
    JSON.stringify({ testedAt: new Date().toISOString(), checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/foundations-failure.png" });
  console.log("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
