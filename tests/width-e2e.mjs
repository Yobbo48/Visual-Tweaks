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
  route = "/?vt-test=width-contract",
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
  const node = (id) => frame().locator(`[data-vt-id="${id}"]`);
  const widthField = () => ui('.context-popover [data-property="width"]');
  const close = () => ui(".context-popover .popover-heading button").click();
  const diagnostics = [];
  async function select(id) {
    await node(id).click({ position: { x: 1, y: 1 } });
    assert.ok(
      (await ui("#panel .info code").allTextContents()).includes(
        `[data-vt-id="${id}"]`,
      ),
    );
  }
  async function savedPayload() {
    const requested = page.waitForRequest(
      (r) => r.method() === "PUT" && r.url().includes("visual-tweaks"),
    );
    const responded = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" && r.url().includes("visual-tweaks"),
    );
    await save();
    const request = await requested,
      response = await responded;
    assert.equal(response.status(), 200);
    return request.postDataJSON();
  }
  // Opening controls, switching viewports and selecting a theme element are read-only.
  for (const mode of ["desktop", "tablet", "mobile", "desktop"]) {
    await ui(`[data-mode="${mode}"]`).click();
    await select("width-case-0");
    await action("size");
    assert.equal(await widthField().inputValue(), "");
    assert.ok(await widthField().getAttribute("placeholder"));
    await close();
    await ui('details[data-group="size"] summary').click();
    await ui("#toggle-panel").click();
    await ui("#toggle-panel").click();
    assert.equal(await ui("#state").textContent(), "Enregistré");
    assert.equal(await ui("#save").isDisabled(), true);
  }
  record(
    "selection, size panel, panel toggles and all breakpoints create no override",
  );
  for (let index = 0; index < 8; index++) {
    const id = `width-case-${index}`;
    await select(id);
    const measured = await node(id).evaluate((n) => ({
      theme: n.style.width,
      computed: getComputedStyle(n).width,
      rect: n.getBoundingClientRect().width,
      offset: n.offsetWidth,
    }));
    if (index === 0) {
      await action("background");
      await ui(
        '.context-popover [data-property="background-color"] input[type="text"]',
      ).fill("#123456");
      await close();
    } else await node(id).press("ArrowRight");
    const payload = await savedPayload();
    for (const element of payload.elements)
      for (const [breakpoint, changes] of Object.entries(element.changes))
        assert.equal(
          Object.hasOwn(changes, "width"),
          false,
          `${element.id}/${breakpoint}`,
        );
    diagnostics.push({
      element: id,
      measured,
      width: "absent",
      provenance: "theme only; no user width edit",
    });
    await page.reload();
    await ready();
    assert.equal(await node(id).evaluate((n) => n.style.width), measured.theme);
    if (index === 0)
      assert.equal(
        await node(id).evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(18, 52, 86)",
      );
    else
      assert.match(
        await node(id).evaluate((n) => getComputedStyle(n).translate),
        /^1px/,
      );
  }
  record(
    "fit/min/max-content, calc, clamp, decimal, auto and percentage theme widths never enter color/position payloads; edits survive refresh",
  );
  // A real resize on fractional content-box dimensions must obey PHP's four-decimal contract.
  await select("width-case-5");
  await drag(ui('[data-corner="se"]'), 40, 20);
  const resized = await savedPayload();
  const resizeEntry = resized.elements.find((e) => e.id === "width-case-5");
  const generated = resizeEntry.changes.desktop.width;
  assert.match(generated, /^\d+(?:\.\d{1,4})?px$/);
  diagnostics.push({
    width: generated,
    type: typeof generated,
    breakpoint: "desktop",
    provenance: "explicit resize, canonicalized",
    http: 200,
  });
  await page.reload();
  await ready();
  assert.ok(
    Math.abs(
      parseFloat(
        await node("width-case-5").evaluate((n) => getComputedStyle(n).width),
      ) - parseFloat(generated),
    ) < 0.1,
  );
  record(
    "fractional resize generates canonical width and survives REST save and refresh",
  );
  await select("width-case-0");
  await action("size");
  for (const [input, canonical] of [
    ["127", "127px"],
    ["127.125", "127.125px"],
    ["127.123456789px", "127.1235px"],
    ["57.5%", "57.5%"],
    ["12.25rem", "12.25rem"],
    ["8em", "8em"],
    ["20vw", "20vw"],
    ["20vh", "20vh"],
    ["0", "0"],
    ["auto", "auto"],
  ]) {
    await widthField().fill(input);
    await widthField().press("Tab");
    const payload = await savedPayload();
    const item = payload.elements.find((e) => e.id === "width-case-0");
    assert.equal(item.changes.desktop.width, canonical);
    assert.equal(typeof item.changes.desktop.width, "string");
    diagnostics.push({
      input,
      width: canonical,
      type: "string",
      breakpoint: "desktop",
      provenance: "explicit width field",
      http: 200,
    });
  }
  await close();
  await page.reload();
  await ready();
  await select("width-case-0");
  await action("size");
  assert.equal(await widthField().inputValue(), "auto");
  await widthField().fill("");
  await widthField().press("Tab");
  const cleared = await savedPayload();
  assert.equal(
    Object.hasOwn(
      cleared.elements.find((e) => e.id === "width-case-0").changes.desktop,
      "width",
    ),
    false,
  );
  await close();
  record(
    "explicit widths normalize px, decimals, %, rem, em, vw, vh, zero and auto; blank removes the override",
  );
  // Actual PHP/JS parity, including payload types the editor must never send.
  const template = cleared.elements.find((e) => e.id === "width-case-0");
  const cases = [
    ["width", "127px", true],
    ["width", "127.125px", true],
    ["width", "50%", true],
    ["width", "2rem", true],
    ["width", "2em", true],
    ["width", "20vw", true],
    ["width", "20vh", true],
    ["width", "0", true],
    ["width", "auto", true],
    ["max-width", "none", true],
    ["max-width", "auto", false],
    ["width", "none", false],
    ["width", "", false],
    ["width", "fit-content", true],
    ["width", "max-content", false],
    ["width", "min-content", false],
    ["width", "calc(100% - 2px)", false],
    ["width", "clamp(1px, 2vw, 3px)", false],
    ["width", "167.10899999999998px", false],
    ["width", "NaNpx", false],
    ["width", 127, false],
    ["width", { value: 127, unit: "px" }, false],
  ];
  const { validValue } = await import("../visual-tweaks/assets/validation.js");
  for (const [property, value, expected] of cases) {
    const entry = structuredClone(template);
    entry.changes = { desktop: { [property]: value } };
    const current = await api("GET", { page: route + "-values" });
    const result = await api("PUT", {
      page: route + "-values",
      revision: current.data.revision,
      elements: [entry],
    });
    assert.equal(validValue(property, value), expected);
    assert.equal(result.status, expected ? 200 : 400, JSON.stringify(value));
    if (!expected)
      assert.equal(result.data.message, `Valeur refusée : ${property}`);
  }
  record(
    "PHP and JavaScript validators agree; arbitrary CSS, overprecision, NaN, numbers and structured widths remain refused",
  );
  // Explicit mobile width stays an exception. Undo/redo do not capture theme widths.
  await select("width-case-0");
  await ui('[data-mode="mobile"]').click();
  await select("width-case-0");
  await action("size");
  await widthField().fill("93.25px");
  await widthField().press("Tab");
  await close();
  await ui("#undo").click();
  await action("size");
  assert.equal(await widthField().inputValue(), "");
  await close();
  await ui("#redo").click();
  const mobile = await savedPayload();
  assert.equal(
    mobile.elements.find((e) => e.id === "width-case-0").changes.mobile.width,
    "93.25px",
  );
  assert.equal(
    Object.hasOwn(
      mobile.elements.find((e) => e.id === "width-case-0").changes.desktop,
      "width",
    ),
    false,
  );
  await page.reload();
  await ready();
  await ui('[data-mode="mobile"]').click();
  assert.ok(
    Math.abs(
      parseFloat(
        await node("width-case-0").evaluate((n) => getComputedStyle(n).width),
      ) - 93.25,
    ) < 0.1,
  );
  record(
    "mobile width is explicit, undo/redo work and the exception persists after reload",
  );
  // Public view reapplies the wanted edit without ever freezing the theme's width.
  const publicContext = await browser.newContext({
      viewport: { width: 1560, height: 1050 },
    }),
    publicPage = await publicContext.newPage();
  await publicPage.goto(base + route);
  await publicPage.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('[data-vt-id="width-case-0"]'))
        .backgroundColor === "rgb(18, 52, 86)",
  );
  assert.equal(
    await publicPage
      .locator('[data-vt-id="width-case-0"]')
      .evaluate((n) => n.style.width),
    "fit-content",
  );
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  await publicContext.close();
  record(
    "public rendering preserves theme fit-content and reapplies saved color",
  );
  // Old failed drafts retain user intent: repair precision, never silently delete invalid data.
  async function seedDraft(width) {
    const saved = await api("GET", { page: route });
    const elements = structuredClone(saved.data.elements);
    elements.find((e) => e.id === "width-case-0").changes.desktop.width = width;
    await page.evaluate(
      ({ elements, revision }) => {
        const cfg = window.VisualTweaksConfig;
        const key = `visual-tweaks:${location.origin}:${cfg.editor.userId}:${cfg.page}`;
        localStorage.setItem(
          key,
          JSON.stringify({ page: cfg.page, revision, elements }),
        );
      },
      { elements, revision: saved.data.revision },
    );
    await page.reload();
    await ready();
    const recover = ui("#recovery").getByRole("button", { name: "Récupérer le brouillon local" });
    if (await recover.count()) await recover.click();
  }
  await seedDraft("167.10899999999998px");
  const repaired = await savedPayload();
  assert.equal(
    repaired.elements.find((e) => e.id === "width-case-0").changes.desktop
      .width,
    "167.109px",
  );
  record(
    "recovering a legacy failed resize repairs existing width precision and saves user intent",
  );
  await seedDraft("NaNpx");
  let puts = 0;
  const countPUT = (request) => {
    if (request.method() === "PUT" && request.url().includes("visual-tweaks"))
      puts++;
  };
  page.on("request", countPUT);
  await ui("#save").click();
  await ui("#global-error").waitFor({ state: "visible" });
  assert.match(
    await ui("#global-error").textContent(),
    /Largeur invalide.*desktop/,
  );
  assert.equal(puts, 0);
  assert.equal(
    await ui("#state").textContent(),
    "Modifications non enregistrées",
  );
  assert.ok(
    await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) =>
          k.startsWith("visual-tweaks:") &&
          localStorage.getItem(k).includes("NaNpx"),
      ),
    ),
  );
  page.off("request", countPUT);
  await select("width-case-0");
  await action("size");
  assert.equal(await widthField().inputValue(), "NaNpx");
  await widthField().fill("");
  await widthField().press("Tab");
  await close();
  const corrected = await savedPayload();
  assert.equal(
    Object.hasOwn(
      corrected.elements.find((e) => e.id === "width-case-0").changes.desktop,
      "width",
    ),
    false,
  );
  record(
    "invalid legacy width is reported before REST, retained in the draft, and cleared only by user action",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/width-test-report.json",
    JSON.stringify(
      { testedAt: new Date().toISOString(), checks, diagnostics },
      null,
      2,
    ),
  );
  await page.screenshot({ path: "artifacts/width-after-fix.png" });
} catch (error) {
  await page.screenshot({ path: "artifacts/width-failure.png" });
  throw error;
} finally {
  await browser.close();
}
