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
  route = "/?vt-test=ux-v2",
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
try {
  await page.goto(base + "/wp-login.php");
  await page.waitForTimeout(250); // WordPress login autofocus settles after 200 ms.
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
  await page.goto(base + route + "&vt-edit=1");
  await ready();
  const original = await api("GET", { page: route });
  await api("PUT", {
    page: route,
    revision: original.data.revision,
    elements: [],
  });
  await page.reload();
  await ready();
  const title = frame().locator('[data-vt-id="hero-title"]');
  await title.dblclick();
  assert.equal(await title.getAttribute("contenteditable"), "plaintext-only");
  await title.fill("Mon titre");
  await title.press("ArrowRight");
  await title.pressSequentially(" vivant");
  assert.equal(await title.textContent(), "Mon titre vivant");
  await action("bold");
  await action("italic");
  assert.equal(
    await title.evaluate((n) => getComputedStyle(n).fontWeight),
    "700",
  );
  assert.equal(
    await title.evaluate((n) => getComputedStyle(n).fontStyle),
    "italic",
  );
  await action("text");
  const quick = ui(".context-popover");
  await quick.locator('[data-property="font-size"]').fill("48");
  await quick.locator('[data-property="font-family"]').selectOption('"Arial"');
  assert.equal(
    await title.evaluate((n) => getComputedStyle(n).fontSize),
    "48px",
  );
  assert.ok(
    (await title.evaluate((n) => getComputedStyle(n).fontFamily)).includes(
      "Arial",
    ),
  );
  await action("color");
  await ui('.context-popover input[aria-label="Couleur — code couleur"]').fill(
    "#aa3344",
  );
  await ui('.context-popover input[aria-label="Couleur — code couleur"]').press(
    "Tab",
  );
  await ui(".context-popover")
    .getByRole("button", { name: "Ajouter à mes couleurs" })
    .click();
  assert.equal(
    await title.evaluate((n) => getComputedStyle(n).color),
    "rgb(170, 51, 68)",
  );
  await action("edit");
  assert.equal(await title.getAttribute("contenteditable"), null);
  await ui("#undo").click();
  assert.equal(await title.textContent(), "Un détail change tout.");
  await ui("#redo").click();
  assert.equal(await title.textContent(), "Mon titre vivant");
  record(
    "direct text editing keeps caret, applies quick typography/color, groups undo and redo",
  );
  await save();
  await page.reload();
  await ready();
  assert.equal(
    await frame().locator('[data-vt-id="hero-title"]').textContent(),
    "Mon titre vivant",
  );
  record("inline text, font, italic, size and color survive refresh");
  await frame().locator('[data-vt-id="hero-title"]').dblclick();
  await frame().locator('[data-vt-id="hero-title"]').fill("À annuler");
  await frame().locator('[data-vt-id="hero-title"]').press("Escape");
  assert.equal(
    await frame().locator('[data-vt-id="hero-title"]').textContent(),
    "Mon titre vivant",
  );
  assert.equal(await ui("#state").textContent(), "Enregistré");
  record("Escape cancels only the current inline transaction");
  await action("edit");
  await frame()
    .locator('[data-vt-id="hero-title"]')
    .fill("<img src=x onerror=alert(1)>");
  await action("edit");
  await save();
  assert.equal(
    await frame().locator('[data-vt-id="hero-title"] img').count(),
    0,
  );
  await page.reload();
  await ready();
  assert.equal(
    await frame().locator('[data-vt-id="hero-title"]').textContent(),
    "<img src=x onerror=alert(1)>",
  );
  record("literal HTML stays text across REST save and reload");
  await frame().locator('[data-vt-id="hero-title"]').dblclick();
  await frame()
    .locator('[data-vt-id="hero-title"]')
    .fill("Un détail, ajusté en direct.");
  await action("edit");
  await save();
  await frame().locator('[data-vt-id="hero-title"]').click();
  await action("color");
  assert.ok(
    (await ui(
      '.context-popover button[aria-label="Utiliser #aa3344"]',
    ).count()) > 0,
  );
  record("personal and recent colors remain available without external assets");
  await action("alignment");
  await ui('.context-popover [data-property="text-align"]').selectOption(
    "center",
  );
  await save();
  await ui(".context-popover .popover-heading button").click();
  await page.screenshot({ path: "artifacts/ux-text-desktop.png" });
  const image = frame().locator('[data-vt-id="hero-phone"]');
  await image.click();
  const before = await image.evaluate((n) => ({
    width: n.offsetWidth,
    height: n.offsetHeight,
    transform: getComputedStyle(n).transform,
  }));
  await drag(ui(".resize-handle.se"), 45, 35);
  const after = await image.evaluate((n) => ({
    width: n.offsetWidth,
    height: n.offsetHeight,
    transform: getComputedStyle(n).transform,
  }));
  assert.ok(after.width > before.width + 10);
  assert.ok(
    Math.abs(after.width / after.height - before.width / before.height) < 0.015,
  );
  assert.equal(after.transform, before.transform);
  await ui("#undo").click();
  assert.equal(await image.evaluate((n) => n.offsetWidth), before.width);
  await ui("#redo").click();
  assert.equal(await image.evaluate((n) => n.offsetWidth), after.width);
  record("resize rotated image with ratio locked and one undo step");
  await drag(image, 0, -18);
  const moved = await image.evaluate((n) => getComputedStyle(n).translate);
  await ui("#undo").click();
  assert.notEqual(
    await image.evaluate((n) => getComputedStyle(n).translate),
    moved,
  );
  await ui("#redo").click();
  record("drag the selected image directly without absolute positioning");
  await action("size");
  await ui('.context-popover [data-property="height"]').fill(
    String(Math.round(after.height * 0.65)),
  );
  await ui('.context-popover [data-property="height"]').press("Tab");
  await ui(".context-popover .popover-heading button").click();
  const cropBefore = await image.evaluate(
    (n) => getComputedStyle(n).objectPosition,
  );
  await action("crop");
  await drag(image, 0, 30);
  assert.notEqual(
    await image.evaluate((n) => getComputedStyle(n).objectPosition),
    cropBefore,
  );
  assert.match(
    await image.evaluate((n) => getComputedStyle(n).objectPosition),
    /^\d+% \d+%$/,
  );
  await action("crop");
  record("visual image cropping by dragging in its actual frame");
  await action("style");
  await ui('.context-popover [data-property="border-radius"]').fill("30");
  await ui('.context-popover [data-property="border-radius"]').press("Tab");
  await save();
  await page.reload();
  await ready();
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).borderRadius),
    "30px",
  );
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => n.offsetWidth),
    after.width,
  );
  record("image size and appearance persist");
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await page.screenshot({ path: "artifacts/ux-image-desktop.png" });
  for (const [mode, width] of [
    ["tablet", 200],
    ["mobile", 160],
  ]) {
    await ui(`[data-mode="${mode}"]`).click();
    await action("size");
    await ui('.context-popover [data-property="width"]').fill(String(width));
    await ui('.context-popover [data-property="width"]').press("Tab");
    assert.equal(
      await frame()
        .locator('[data-vt-id="hero-phone"]')
        .evaluate((n) => n.offsetWidth),
      width,
    );
    assert.equal(
      await ui(`[data-mode="${mode}"]`).evaluate((n) =>
        n.classList.contains("has-exceptions"),
      ),
      true,
    );
    await save();
    await page.screenshot({ path: `artifacts/ux-image-${mode}.png` });
  }
  await page.reload();
  await ready();
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await ui('[data-mode="mobile"]').click();
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => n.offsetWidth),
    160,
  );
  record(
    "tablet/mobile quick sizing and visible exceptions persist independently",
  );
  await ui('[data-mode="desktop"]').click();
  await frame()
    .locator(".hero")
    .click({ position: { x: 5, y: 5 } });
  await action("alignment");
  await ui(
    '.context-popover [data-align-scope="content"][data-align-axis="vertical"][data-align-value="top"]',
  ).click();
  await save();
  assert.equal(
    await frame()
      .locator(".hero")
      .evaluate((n) => getComputedStyle(n).alignItems),
    "start",
  );
  record("contextual alignment for the existing grid container");
  const cardsRect = await frame().locator(".cards").boundingBox();
  await frame()
    .locator(".cards")
    .click({ position: { x: cardsRect.width / 2, y: 30 } });
  await action("spacing");
  await ui('.context-popover [data-property="gap"]').fill("36");
  await ui('.context-popover [data-property="gap"]').press("Tab");
  await save();
  assert.equal(
    await frame()
      .locator(".cards")
      .evaluate((n) => getComputedStyle(n).gap),
    "36px",
  );
  record("contextual spacing for the existing flex container");
  await ui(".context-popover .popover-heading button").click();
  await frame().locator(".cta").click();
  await action("link");
  await ui('.context-popover input[aria-label="Adresse du lien"]').fill(
    "https://example.test/contact",
  );
  await ui('.context-popover input[aria-label="Adresse du lien"]').press("Tab");
  await save();
  assert.equal(
    await frame().locator(".cta").getAttribute("href"),
    "https://example.test/contact",
  );
  const stored = await api("GET", { page: route });
  const bad = structuredClone(stored.data.elements);
  bad.find((e) => e.fingerprint.tag === "a").content.href =
    "javascript:alert(1)";
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: stored.data.revision,
        elements: bad,
      })
    ).status,
    400,
  );
  record(
    "existing link editing is safe and executable schemes are refused server-side",
  );
  await ui(".context-popover .popover-heading button").click();
  await ui("#toggle-panel").click();
  assert.equal(await ui("#properties").isVisible(), false);
  assert.equal(await ui("#context-toolbar").isVisible(), true);
  await ui("#undo").click();
  assert.equal(await ui("#properties").isVisible(), false);
  await ui("#redo").click();
  assert.equal(await ui("#properties").isVisible(), false);
  await ui("#toggle-panel").click();
  record("common actions remain available with the detailed panel hidden");
  assert.equal(
    await ui("button")
      .filter({ hasText: /^Supprimer$/ })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  record("theme elements cannot be deleted and browser has no uncaught errors");
  await writeFile(
    "artifacts/ux-test-report.json",
    JSON.stringify({ testedAt: new Date().toISOString(), checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/ux-failure.png" });
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
