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
  route = "/?vt-test=save-contract",
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
  const old = await api("GET", { page: route });
  await api("PUT", { page: route, revision: old.data.revision, elements: [] });
  await page.reload();
  await ready();
  const title = () => frame().locator('[data-vt-id="hero-title"]');
  await title().dblclick();
  await title().fill("Premier texte sauvegardé");
  await save();
  await page.reload();
  await ready();
  record("content-only save survives refresh");
  await title().click();
  await action("text");
  await ui('.context-popover [data-property="font-size"]').fill("42");
  await ui('.context-popover [data-property="font-size"]').press("Tab");
  await ui(".context-popover .popover-heading button").click();
  await action("edit");
  await title().fill("Texte et taille persistants");
  const sent = page.waitForRequest(
    (r) => r.method() === "PUT" && r.url().includes("visual-tweaks"),
  );
  const response = page.waitForResponse(
    (r) => r.request().method() === "PUT" && r.url().includes("visual-tweaks"),
  );
  await save();
  const request = await sent,
    result = await response;
  assert.equal(result.status(), 200);
  const stored = await api("GET", { page: route });
  const persisted = stored.data.elements.find((e) => e.id === "hero-title");
  await writeFile(
    "artifacts/save-contract-diagnostic.json",
    JSON.stringify(
      {
        http: result.status(),
        sentChanges: request.postDataJSON().elements[0].changes,
        storedChanges: persisted.changes,
        revision: stored.data.revision,
      },
      null,
      2,
    ),
  );
  assert.equal(
    persisted.changes.desktop?.["font-size"],
    "42px",
    "style applied on screen must be included in REST storage after a content-only save",
  );
  assert.equal(await ui("#state").textContent(), "Enregistré");
  await page.reload();
  await ready();
  assert.equal(
    await title().evaluate((n) => getComputedStyle(n).fontSize),
    "42px",
  );
  assert.equal(await title().textContent(), "Texte et taille persistants");
  record("save status, REST storage and editor refresh match the visual draft");
  await ui("#exit").click();
  await page.waitForURL((u) => !u.searchParams.has("vt-edit"));
  assert.equal(
    await page
      .locator('[data-vt-id="hero-title"]')
      .evaluate((n) => getComputedStyle(n).fontSize),
    "42px",
  );
  await page.locator("#wp-admin-bar-visual-tweaks a").click();
  await ready();
  assert.equal(
    await title().evaluate((n) => getComputedStyle(n).fontSize),
    "42px",
  );
  assert.equal(await ui("#state").textContent(), "Enregistré");
  record("exit and reenter reload the saved revision with no recovery prompt");
  const publicContext = await browser.newContext(),
    publicPage = await publicContext.newPage();
  await publicPage.goto(base + route);
  await publicPage.waitForFunction(
    () =>
      document.querySelector('[data-vt-id="hero-title"]').textContent ===
      "Texte et taille persistants",
  );
  assert.equal(
    await publicPage
      .locator('[data-vt-id="hero-title"]')
      .evaluate((n) => getComputedStyle(n).fontSize),
    "42px",
  );
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  await publicContext.close();
  record(
    "anonymous public rendering applies the persisted overrides without editor UI",
  );
  await title().click();
  await action("text");
  await ui('.context-popover [data-property="font-size"]').fill("44");
  await ui('.context-popover [data-property="font-size"]').press("Tab");
  await ui(".context-popover .popover-heading button").click();
  await ui("#toggle-panel").click();
  await page.route(/visual-tweaks/, async (route) =>
    route.request().method() === "PUT" ? route.abort() : route.continue(),
  );
  await ui("#save").click();
  await ui("#global-error").waitFor({ state: "visible" });
  assert.match(
    await ui("#global-error").textContent(),
    /Sauvegarde impossible/,
  );
  assert.equal(
    await ui("#state").textContent(),
    "Modifications non enregistrées",
  );
  assert.ok(
    await page.evaluate(() =>
      Object.keys(localStorage).some(
        (key) =>
          key.startsWith("visual-tweaks:") &&
          localStorage.getItem(key).includes("44px"),
      ),
    ),
  );
  await page.unroute(/visual-tweaks/);
  await save();
  assert.equal(
    (await api("GET", { page: route })).data.elements[0].changes.desktop[
      "font-size"
    ],
    "44px",
  );
  record(
    "failed request is visible with settings hidden, preserves local draft, and can be retried",
  );
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const reached = new Promise((resolve) => {
    entered = resolve;
  });
  await action("text");
  await ui('.context-popover [data-property="font-size"]').fill("45");
  await page.route(/visual-tweaks/, async (intercepted) => {
    if (intercepted.request().method() === "PUT") {
      entered();
      await gate;
    }
    await intercepted.continue();
  });
  await ui("#save").click();
  await reached;
  await ui('.context-popover [data-property="font-size"]').fill("46");
  release();
  await ui("#state")
    .filter({ hasText: /^Modifications non enregistrées$/ })
    .waitFor();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("#vt-editor-host")
        .shadowRoot.querySelector("#save").disabled,
  );
  assert.equal(
    (await api("GET", { page: route })).data.elements[0].changes.desktop[
      "font-size"
    ],
    "45px",
  );
  await page.unroute(/visual-tweaks/);
  await save();
  assert.equal(
    (await api("GET", { page: route })).data.elements[0].changes.desktop[
      "font-size"
    ],
    "46px",
  );
  await ui(".context-popover .popover-heading button").click();
  record("edits made while saving remain dirty and persist on the next save");
  const current = await api("GET", { page: route });
  await api("PUT", {
    page: route,
    revision: current.data.revision,
    elements: current.data.elements,
  });
  await action("text");
  await ui('.context-popover [data-property="font-size"]').fill("47");
  await ui(".context-popover .popover-heading button").click();
  await ui("#save").click();
  await ui("#global-error").waitFor({ state: "visible" });
  assert.match(await ui("#global-error").textContent(), /autre session/);
  assert.equal(
    await ui("#state").textContent(),
    "Modifications non enregistrées",
  );
  assert.equal(
    (await api("GET", { page: route })).data.elements[0].changes.desktop[
      "font-size"
    ],
    "46px",
  );
  await ui("#toggle-panel").click();
  const download = page.waitForEvent("download");
  await ui("#export").click();
  const exported = await download;
  assert.ok(exported.suggestedFilename().endsWith(".json"));
  record(
    "409 conflict stays visible and preserves an exportable draft without overwriting WordPress",
  );
  await ui("#discard").click();
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/save-test-report.json",
    JSON.stringify({ testedAt: new Date().toISOString(), checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/save-failure.png" });
  throw error;
} finally {
  await browser.close();
}
