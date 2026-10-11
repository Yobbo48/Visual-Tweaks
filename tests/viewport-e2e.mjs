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
const base = "http://127.0.0.1:9410",
  route = `/?vt-test=viewport-${engine}`,
  checks = [],
  errors = [];
page.on("pageerror", (e) => {
  errors.push({ message: e.message, stack: e.stack });
  console.log("BROWSER ERROR", e.stack);
});
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
  await page.evaluate(() => {
    const frame = document
      .querySelector("#vt-editor-host")
      .shadowRoot.querySelector("iframe");
    const probe = (window.__vtPointerProbe = {
      zoom: VisualTweaksViewport.diagnostics().zoom,
    });
    const controller = new AbortController();
    probe.controller = controller;
    for (const doc of [document, frame.contentDocument])
      for (const type of ["pointerdown", "pointermove"])
        doc.defaultView.addEventListener(
          type,
          (event) => {
            const point = {
              x: event.clientX,
              y: event.clientY,
              inFrame: doc === frame.contentDocument,
            };
            if (type === "pointerdown") probe.down = point;
            else if (event.buttons === 1) probe.last = point;
          },
          { capture: true, signal: controller.signal },
        );
  });
  const rect = await locator.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + dx,
    rect.y + rect.height / 2 + dy,
    { steps: 8 },
  );
  await page.mouse.up();
  return page.evaluate(() => {
    const p = window.__vtPointerProbe;
    p.controller.abort();
    if (!p.down || !p.last)
      throw new Error("Gesture did not receive native pointer events");
    const scale = p.down.inFrame ? 1 : p.zoom;
    return {
      x: (p.last.x - p.down.x) / scale,
      y: (p.last.y - p.down.y) / scale,
      native: { down: p.down, last: p.last, zoom: p.zoom },
    };
  });
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
    { waitUntil: "domcontentloaded" },
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
  await page.goto(base + route + "&vt-edit=1", {
    waitUntil: "domcontentloaded",
  });
  await ready();
  await fontsReady();
  const old = await api("GET", { page: route });
  await api("PUT", { page: route, revision: old.data.revision, elements: [] });
  await page.reload();
  await ready();
  await fontsReady();
  const asset = () => frame().locator('[data-vt-id="reference-asset"]');
  const diagnosis = () =>
    page.evaluate(() => window.VisualTweaksViewport.diagnostics());
  const baseline = await metrics(asset());
  let d = await diagnosis();
  assert.equal(d.logicalViewport.width, 1440);
  assert.equal(d.innerWidth, 1440);
  assert.ok(d.availableCanvas.width < 1200);
  assert.ok(d.zoom < 1);
  assert.equal(await frame().locator(".reference-nav").isVisible(), true);
  assert.equal(await frame().locator(".reference-menu").isVisible(), false);
  assert.equal(d.adminBar, false);
  assert.equal(
    await frame()
      .locator("body")
      .evaluate((n) => n.classList.contains("admin-bar")),
    false,
  );
  assert.equal(
    await frame()
      .locator("html")
      .evaluate((n) => getComputedStyle(n).marginTop),
    "0px",
  );
  closeEnough(baseline.width, 400);
  assert.equal(baseline.marginLeft, "100px");
  let display = await asset().boundingBox();
  closeEnough(display.width, 400 * d.zoom);
  record(
    `${engine}: logical 1440px keeps desktop navigation despite sidebar; public admin-bar-free geometry 400/100 is scaled only for display`,
  );
  await asset().click();
  await page.waitForTimeout(100);
  display = await asset().boundingBox();
  const outline = await ui(".outline.selected").boundingBox();
  closeEnough(outline.x, display.x);
  closeEnough(outline.width, display.width);
  const handles = await ui('[data-corner="nw"]').boundingBox();
  closeEnough(handles.x + handles.width / 2, display.x, 2);
  await ui("#viewport-diagnostic").click();
  assert.match(await ui("#canvas-diagnostic").textContent(), /logicalBox/);
  await ui("#viewport-diagnostic").click();
  record(
    `${engine}: outline, corner handles and diagnostic boxes match the zoomed asset`,
  );
  await ui("#toggle-panel").click();
  const wider = await diagnosis();
  assert.equal(wider.innerWidth, 1440);
  closeEnough((await metrics(asset())).width, 400);
  await ui("#toggle-panel").click();
  await page.setViewportSize({ width: 1300, height: 1000 });
  await page.waitForFunction(
    () =>
      window.VisualTweaksViewport.diagnostics().availableCanvas.width < 1100,
  );
  assert.equal((await diagnosis()).innerWidth, 1440);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await ui("#actual-canvas").click();
  assert.equal((await diagnosis()).zoom, 1);
  assert.ok(await ui(".stage").evaluate((n) => n.scrollWidth > n.clientWidth));
  await ui("#fit-canvas").click();
  await ui("#desktop-width").selectOption("current");
  assert.equal((await diagnosis()).innerWidth, 1400);
  await ui("#desktop-width").selectOption("1920");
  assert.equal((await diagnosis()).innerWidth, 1920);
  await ui("#desktop-width").selectOption("1440");
  assert.equal(await ui("#state").textContent(), "Enregistré");
  record(
    `${engine}: sidebar, outer resize, Fit/100%, presets and current-window mode never create overrides or reduce logical desktop width`,
  );
  await asset().click();
  for (let i = 0; i < 10; i++) await asset().press("ArrowRight");
  assert.equal((await metrics(asset())).translate, "10px");
  await ui("#undo").click();
  assert.equal((await metrics(asset())).translate, "none");
  await ui("#redo").click();
  assert.equal((await metrics(asset())).translate, "10px");
  const sent = page.waitForRequest(
    (r) => r.method() === "PUT" && r.url().includes("visual-tweaks"),
  );
  await save();
  const item = (await sent)
    .postDataJSON()
    .elements.find((e) => e.id === "reference-asset");
  assert.equal(item.changes.desktop.translateX, "10px");
  assert.equal(Object.hasOwn(item.changes.desktop, "width"), false);
  await page.reload();
  await ready();
  await fontsReady();
  assert.equal((await metrics(asset())).translate, "10px");
  record(
    `${engine}: ten arrows save 10 logical CSS pixels, undo/redo and refresh preserve them`,
  );
  const publicContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    publicPage = await publicContext.newPage();
  await publicPage.goto(base + route);
  await publicPage.evaluate(() => document.fonts.ready);
  await publicPage.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('[data-vt-id="reference-asset"]'))
        .translate === "10px",
  );
  const editorBox = await metrics(asset()),
    publicBox = await metrics(
      publicPage.locator('[data-vt-id="reference-asset"]'),
    );
  for (const property of ["x", "y", "width", "height"])
    closeEnough(editorBox[property], publicBox[property]);
  assert.equal(await publicPage.locator(".reference-nav").isVisible(), true);
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  record(
    `${engine}: anonymous real page at 1440px matches logical editor placement and layout`,
  );
  await asset().click();
  d = await diagnosis();
  const handleDelta = await drag(
    ui(".selected .drag"),
    30 * d.zoom,
    15 * d.zoom,
  );
  // WebKit quantizes native UI pointer coordinates to screen pixels. Check the exact
  // logical value implied by those events, not an unreceived fractional mouse position.
  let expectedX = Math.round(10 + handleDelta.x),
    expectedY = Math.round(handleDelta.y);
  assert.equal(
    (await metrics(asset())).translate,
    `${expectedX}px ${expectedY}px`,
  );
  closeEnough(handleDelta.x, 30, 2);
  closeEnough(handleDelta.y, 15, 2);
  const directDelta = await drag(asset(), 20 * d.zoom, 10 * d.zoom);
  expectedX = Math.round(expectedX + directDelta.x);
  expectedY = Math.round(expectedY + directDelta.y);
  assert.equal(
    (await metrics(asset())).translate,
    `${expectedX}px ${expectedY}px`,
  );
  closeEnough(directDelta.x, 20, 2);
  closeEnough(directDelta.y, 10, 2);
  record(
    `${engine}: UI move handle and direct iframe drag use the same logical coordinate system under zoom`,
  );
  await drag(ui('[data-corner="se"]'), 50 * d.zoom, 25 * d.zoom);
  closeEnough((await metrics(asset())).width, 450, 2);
  closeEnough((await metrics(asset())).height, 225, 2);
  await ui("#undo").click();
  closeEnough((await metrics(asset())).width, 400);
  await ui("#redo").click();
  closeEnough((await metrics(asset())).width, 450, 2);
  await save();
  await page.reload();
  await ready();
  await fontsReady();
  closeEnough((await metrics(asset())).width, 450, 2);
  record(
    `${engine}: corner resize preserves ratio and logical size with undo/redo and persisted refresh`,
  );
  await asset().click();
  await action("crop");
  const beforeCrop = await metrics(asset());
  await drag(asset(), 10 * (await diagnosis()).zoom, 0);
  const afterCrop = await metrics(asset());
  closeEnough(beforeCrop.x, afterCrop.x);
  closeEnough(beforeCrop.width, afterCrop.width);
  await action("crop");
  record(`${engine}: focal crop does not move or resize the asset when zoomed`);
  await ui('[data-mode="tablet"]').click();
  assert.equal((await diagnosis()).innerWidth, 820);
  assert.equal(await frame().locator(".reference-menu").isVisible(), true);
  await ui('[data-mode="mobile"]').click();
  assert.equal((await diagnosis()).innerWidth, 390);
  await asset().click();
  await action("size");
  await ui('.context-popover [data-property="width"]').fill("200");
  await ui('.context-popover [data-property="width"]').press("Tab");
  await ui(".context-popover .popover-heading button").click();
  await save();
  await page.reload();
  await ready();
  await ui('[data-mode="mobile"]').click();
  closeEnough((await metrics(asset())).width, 200);
  const persisted = await api("GET", { page: route });
  assert.equal(
    persisted.data.elements.find((e) => e.id === "reference-asset").changes
      .mobile.width,
    "200px",
  );
  record(
    `${engine}: tablet/mobile use true viewports and persist explicit responsive exceptions`,
  );
  await asset().click();
  await action("size");
  await ui('.context-popover [data-property="width"]')
    .locator("..")
    .getByRole("button", {
      name: "Réinitialiser ce réglage : Largeur",
      exact: true,
    })
    .click();
  closeEnough((await metrics(asset())).width, 450, 2);
  await action("size");
  await ui('.context-popover [data-property="width"]').fill("190");
  await ui(".context-popover .popover-heading button").click();
  await ui("#reset-breakpoint").click();
  closeEnough((await metrics(asset())).width, 450, 2);
  await ui("#reset-element").click();
  closeEnough((await metrics(asset())).width, 400);
  assert.equal((await metrics(asset())).translate, "none");
  await save();
  await page.reload();
  await ready();
  const reset = await api("GET", { page: route });
  assert.equal(
    reset.data.elements.some((e) => e.id === "reference-asset"),
    false,
  );
  await publicPage.reload();
  closeEnough(
    (await metrics(publicPage.locator('[data-vt-id="reference-asset"]'))).width,
    400,
  );
  record(
    `${engine}: property, breakpoint and full-element resets remove overrides and restore exact theme dimensions`,
  );
  await ui('[data-mode="desktop"]').click();
  const rotated = frame().locator('[data-vt-id="reference-rotated"]');
  await rotated.click();
  const original = await metrics(rotated),
    zoom = (await diagnosis()).zoom;
  await drag(ui(".selected .drag"), 20 * zoom, 0);
  const changed = await metrics(rotated);
  closeEnough(changed.x - original.x, 20, 2);
  await ui("#reset-element").click();
  const restored = await metrics(rotated);
  for (const property of ["x", "y", "width", "height"])
    closeEnough(restored[property], original[property]);
  record(
    `${engine}: existing parent rotation remains intact during scaled drag and reset`,
  );
  assert.deepEqual(errors, []);
  await publicContext.close();
  await asset().click();
  await page.screenshot({ path: `artifacts/viewport-${engine}.png` });
  await writeFile(
    `artifacts/viewport-${engine}-report.json`,
    JSON.stringify(
      {
        engine,
        version: browser.version(),
        checks,
        pointerGestures: { handleDelta, directDelta },
        baseline,
        editorBox,
        publicBox,
        diagnostics: await diagnosis(),
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: `artifacts/viewport-${engine}-failure.png` });
  throw error;
} finally {
  await browser.close();
}
