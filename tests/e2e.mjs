import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const requireBrowser = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const { chromium } = requireBrowser("playwright");
const base = "http://127.0.0.1:9410";
const route = "/?vt-test=acceptance";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1560, height: 1050 },
});
const page = await context.newPage();
const errors = [];
let servedPHP = "unknown";
page.on("response", (response) => {
  if (response.url().startsWith(base) && response.headers()["x-powered-by"])
    servedPHP = response.headers()["x-powered-by"];
});
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
let actualWordPress = "unknown";
await mkdir("artifacts", { recursive: true });
async function login(target, user = "vt-admin") {
  await target.goto(`${base}/wp-login.php?redirect_to=${encodeURIComponent(base + route)}`);
  await target.waitForTimeout(250); // WordPress login autofocus settles after 200 ms.
  await target.locator("#user_login").fill(user);
  await target.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    target.waitForURL((url) => !url.pathname.includes("wp-login.php")),
    target.locator("#wp-submit").click(),
  ]);
}
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = window.VisualTweaksConfig.editor;
      const url =
        method === "GET"
          ? `${cfg.api}${cfg.api.includes("?") ? "&" : "?"}page=${encodeURIComponent(body.page)}`
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
async function editor() {
  await page.goto(`${base}${route}&vt-edit=1`);
  await page.locator("#vt-editor-host iframe").waitFor();
  await page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
}
const frame = () => page.frameLocator("#vt-editor-host iframe");
async function expandPanel() {
  for (const summary of await page
    .locator("#vt-editor-host details > summary")
    .all())
    if (!(await summary.evaluate((node) => node.parentElement.open)))
      await summary.click();
}
const prop = (name) =>
  page.locator(`#vt-editor-host [data-property="${name}"]`);
async function save() {
  await page.locator("#vt-editor-host #save").click();
  await page
    .locator("#vt-editor-host #state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
}
try {
  await login(page);
  await editor();
  actualWordPress = (
    await frame().locator('meta[name="generator"]').getAttribute("content")
  ).replace(/^WordPress /, "");
  let stored = await api("GET", { page: route });
  assert.equal(stored.status, 200);
  await api("PUT", {
    page: route,
    revision: stored.data.revision,
    elements: [],
  });
  await editor();
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await expandPanel();
  await prop("translateY").fill("-25px");
  await prop("translateY").press("Tab");
  await prop("max-width").fill("210px");
  await prop("max-width").press("Tab");
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).translate),
    "5px -22px",
  );
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).transform.includes("matrix")),
    true,
  );
  record(
    "select, immediate Y adjustment, preservation of theme transform/translate",
  );
  await page.locator("#vt-editor-host #undo").click();
  await expandPanel();
  assert.equal(await prop("max-width").inputValue(), "");
  await page.locator("#vt-editor-host #redo").click();
  await expandPanel();
  assert.equal(await prop("max-width").inputValue(), "210px");
  record("undo and redo");
  await page.locator('#vt-editor-host [data-mode="mobile"]').click();
  await expandPanel();
  await prop("translateY").fill("12px");
  await prop("translateY").press("Tab");
  await prop("margin-top").fill("10px");
  await prop("margin-top").press("Tab");
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).translate),
    "0px 24px",
  );
  await save();
  record(
    "mobile iframe triggers actual media queries and saves independent overrides",
  );
  await page.reload();
  await page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await expandPanel();
  assert.equal(await prop("translateY").inputValue(), "-25px");
  assert.equal(await prop("max-width").inputValue(), "210px");
  record("persisted adjustments after WordPress reload");
  await page.screenshot({ path: "artifacts/editor-desktop.png" });
  await page.locator('#vt-editor-host [data-mode="mobile"]').click();
  await expandPanel();
  assert.equal(await prop("translateY").inputValue(), "12px");
  await page.screenshot({ path: "artifacts/editor-mobile.png" });
  await page.locator('#vt-editor-host [data-mode="desktop"]').click();
  await expandPanel();
  const scale = await page.evaluate(
    () => window.VisualTweaksViewport.diagnostics().zoom,
  );
  const handle = await page.locator("#vt-editor-host .drag").boundingBox();
  await page.mouse.move(handle.x + 16, handle.y + 16);
  await page.mouse.down();
  await page.mouse.move(handle.x + 16, handle.y + 16 - 10 * scale, {
    steps: 5,
  });
  await page.mouse.up();
  await expandPanel();
  assert.equal(await prop("translateY").inputValue(), "-35px");
  await page.locator("#vt-editor-host #undo").click();
  await expandPanel();
  assert.equal(await prop("translateY").inputValue(), "-25px");
  record("direct drag uses one undo step");
  await prop("translateY").fill("-26px");
  await prop("translateY").press("Tab");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
  assert.match(await page.locator("#vt-editor-host #recovery").textContent(), /restauré/);
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await expandPanel();
  assert.equal(await prop("translateY").inputValue(), "-26px");
  await prop("translateY").fill("-25px");
  await prop("translateY").press("Tab");
  record("unsaved draft recovers after reload");
  const padLocator = page.locator("#vt-editor-host .crop-pad");
  const pad = await padLocator.boundingBox();
  await padLocator.click({
    position: { x: pad.width * 0.3, y: pad.height * 0.75 },
  });
  const imagePosition = await frame()
    .locator('[data-vt-id="hero-phone"]')
    .evaluate((n) => getComputedStyle(n).objectPosition);
  assert.ok(
    Math.abs(parseFloat(imagePosition) - 30) <= 2 &&
      Math.abs(parseFloat(imagePosition.split(" ")[1]) - 75) <= 2,
  );
  await page.locator("#vt-editor-host #replace-image").click();
  await page.locator(".media-modal #menu-item-browse").click();
  await page
    .locator('.media-modal .attachment[aria-label*="VT replacement"]')
    .click();
  await page.locator(".media-modal .media-button-select").click();
  await save();
  await page.reload();
  await page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
  assert.ok(
    (
      await frame().locator('[data-vt-id="hero-phone"]').getAttribute("src")
    ).includes("vt-replacement.png"),
  );
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).objectPosition),
    imagePosition,
  );
  record("WordPress media picker replacement and object-position persist");
  await frame().locator('[data-vt-id="hero-title"]').click();
  await expandPanel();
  await page.locator("#vt-editor-host textarea").fill("Un texte ajusté.");
  await page.locator("#vt-editor-host textarea").press("Tab");
  await save();
  record("non-destructive leaf text override");
  stored = await api("GET", { page: route });
  const forged = structuredClone(stored.data.elements);
  forged[0].changes.desktop.width = "url(javascript:alert(1))";
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: stored.data.revision,
        elements: forged,
      })
    ).status,
    400,
  );
  forged[0].changes.desktop.width = "200px";
  forged[0].selector = "body{color:red}";
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: stored.data.revision,
        elements: forged,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: stored.data.revision - 1,
        elements: [],
      })
    ).status,
    409,
  );
  assert.equal(
    (await api("GET", { page: route })).data.revision,
    stored.data.revision,
  );
  record("strict validation and stale-save conflict preserve stored data");
  const noNonce = await page.evaluate(async () => {
    const response = await fetch(window.VisualTweaksConfig.editor.api, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return response.status;
  });
  assert.equal(noNonce, 403);
  record("missing REST nonce denied");
  const racePage = `${route}&race=${Date.now()}`;
  const race = await Promise.all([
    api("PUT", { page: racePage, revision: 0, elements: [] }),
    api("PUT", { page: racePage, revision: 0, elements: [] }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  record("concurrent first saves admit exactly one writer");
  const visitor = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const publicPage = await visitor.newPage();
  await publicPage.goto(`${base}${route}&vt-edit=1`);
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  assert.equal(await publicPage.locator('script[src*="editor.js"]').count(), 0);
  await publicPage.waitForFunction(() => !!window.VisualTweaksRuntime);
  assert.equal(
    await publicPage
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).translate),
    "5px -22px",
  );
  assert.equal(
    await publicPage.locator('[data-vt-id="hero-title"]').textContent(),
    "Un texte ajusté.",
  );
  assert.equal(
    await publicPage.locator('[data-vt-id="hero-phone"]').getAttribute("style"),
    null,
  );
  assert.equal(
    (
      await publicPage.request.put(`${base}/wp-json/visual-tweaks/v1/page`, {
        data: { page: route, revision: 0, elements: [] },
      })
    ).status(),
    403,
  );
  await publicPage.goto(`${base}/?second=1`);
  assert.equal(
    await publicPage.locator('script[src*="visual-tweaks"]').count(),
    0,
  );
  record(
    "public saved rendering, no editor, no inline styles, isolated page, denied anonymous API",
  );
  const member = await browser.newContext();
  const memberPage = await member.newPage();
  await login(memberPage, "vt-subscriber");
  await memberPage.goto(`${base}${route}&vt-edit=1`);
  assert.equal(await memberPage.locator("#vt-editor-host").count(), 0);
  assert.equal(
    await memberPage.locator("#wp-admin-bar-visual-tweaks").count(),
    0,
  );
  record("subscriber cannot activate editor");
  await member.close();
  // A changed DOM fingerprint must fail closed rather than retouch another target.
  await publicPage.goto(`${base}${route}`);
  await publicPage.waitForFunction(() => !!window.VisualTweaksRuntime);
  const unresolved = await publicPage.evaluate(() => {
    const cfg = structuredClone(window.VisualTweaksConfig.elements);
    cfg[0].fingerprint.tag = "video";
    return window.VisualTweaksRuntime.render(cfg).length;
  });
  assert.equal(unresolved, 1);
  record("changed fingerprint skips override");
  await visitor.close();
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await expandPanel();
  await page.locator("#vt-editor-host #reset-element").click();
  await save();
  await page.reload();
  await page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
  assert.equal(
    await frame()
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).translate),
    "5px 3px",
  );
  record("element reset restores exact original theme CSS after reload");
  await frame().locator('[data-vt-id="hero-phone"]').click();
  await expandPanel();
  assert.equal(await prop("translateY").inputValue(), "");
  record("reset does not reintroduce old element properties");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#vt-editor-host #reset-page").click();
  await save();
  const resetPage = await api("GET", { page: route });
  assert.deepEqual(resetPage.data.elements, []);
  record("whole-page reset persists atomically");
  await page.goto(`${base}/wp-admin/options-general.php?page=visual-tweaks`);
  await page.locator('[name="vt_enabled"]').uncheck();
  await page.locator("#submit").click();
  await page.goto(`${base}${route}&vt-edit=1`);
  assert.equal(await page.locator("#vt-editor-host").count(), 0);
  assert.equal(await page.locator('script[src*="visual-tweaks"]').count(), 0);
  await page.goto(`${base}/wp-admin/options-general.php?page=visual-tweaks`);
  await page.locator('[name="vt_enabled"]').check();
  await page.locator("#submit").click();
  record("complete disable removes editor and override runtime");
  assert.deepEqual(errors, []);
  record("no uncaught browser errors");
  await writeFile(
    "artifacts/test-report.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        wordpress: actualWordPress,
        php: servedPHP,
        checks,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/e2e-failure.png" });
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
